"""Authentication routes — register, login, logout, me, refresh."""

import re
from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token, jwt_required,
    get_jwt_identity, get_jwt,
)
from werkzeug.security import generate_password_hash, check_password_hash

from app.extensions import db, limiter
from app.models import User, TokenBlocklist
from app.utils import success_response, error_response
from app.services import log_action

auth_bp = Blueprint('auth', __name__)

EMAIL_RE = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
MIN_PASSWORD_LENGTH = 8


@auth_bp.post('/register')
@limiter.limit("5 per minute")
def register():
    d = request.get_json(silent=True) or {}

    name = (d.get('name') or '').strip()
    email = (d.get('email') or '').strip().lower()
    password = d.get('password', '')

    errors = {}
    if not name or len(name) < 2:
        errors['name'] = 'Name must be at least 2 characters.'
    if not EMAIL_RE.match(email):
        errors['email'] = 'A valid email address is required.'
    if len(password) < MIN_PASSWORD_LENGTH:
        errors['password'] = f'Password must be at least {MIN_PASSWORD_LENGTH} characters.'
    if errors:
        return error_response('VALIDATION_ERROR', 'Invalid registration data.', 400, errors)

    if User.query.filter_by(email=email).first():
        return error_response('DUPLICATE_EMAIL', 'This email is already registered.', 422)

    # Role is ALWAYS set server-side.  New registrations get 'Analyst'.
    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role='Analyst',
    )
    db.session.add(user)
    log_action('USER_CREATED', 'User', None, {'email': email, 'role': 'Analyst'}, actor_id=None)
    db.session.commit()

    return success_response(
        data={'user': user.to_dict(include_email=True)},
        status=201,
        message='Account created successfully.',
    )


@auth_bp.post('/login')
@limiter.limit("10 per minute")
def login():
    d = request.get_json(silent=True) or {}
    email = (d.get('email') or '').strip().lower()
    password = d.get('password', '')

    if not email or not password:
        return error_response('VALIDATION_ERROR', 'Email and password are required.', 400)

    user = User.query.filter_by(email=email).first()

    if not user or not check_password_hash(user.password_hash, password):
        log_action('LOGIN_FAILURE', 'User', None, {'email': email})
        db.session.commit()
        return error_response('INVALID_CREDENTIALS', 'Email or password is incorrect.', 401)

    if not user.is_active:
        return error_response('ACCOUNT_DISABLED', 'This account has been deactivated.', 403)

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    log_action('LOGIN_SUCCESS', 'User', user.id, actor_id=user.id)
    db.session.commit()

    return success_response(data={
        'access_token': access_token,
        'refresh_token': refresh_token,
        'user': user.to_dict(include_email=True),
    })


@auth_bp.post('/refresh')
@jwt_required(refresh=True)
@limiter.limit("30 per minute")
def refresh():
    uid = get_jwt_identity()
    user = db.session.get(User, int(uid))
    if not user or not user.is_active:
        return error_response('UNAUTHORIZED', 'Invalid session.', 401)

    new_token = create_access_token(identity=str(user.id))
    return success_response(data={'access_token': new_token})


@auth_bp.patch('/change-password')
@jwt_required()
@limiter.limit("5 per minute")
def change_password():
    uid = get_jwt_identity()
    user = db.session.get(User, int(uid))
    if not user:
        return error_response('UNAUTHORIZED', 'User not found.', 401)
    if not user.is_active:
        return error_response('ACCOUNT_DISABLED', 'This account has been deactivated.', 403)

    d = request.get_json(silent=True) or {}
    current_password = d.get('current_password', '')
    new_password = d.get('new_password', '')

    if not current_password or not new_password:
        return error_response('VALIDATION_ERROR', 'Both current password and new password are required.', 400)

    if not check_password_hash(user.password_hash, current_password):
        log_action('PASSWORD_CHANGE_FAILED', 'User', user.id, {'reason': 'incorrect_current_password'}, actor_id=user.id)
        db.session.commit()
        return error_response('INVALID_CREDENTIALS', 'Current password is incorrect.', 401)

    if len(new_password) < MIN_PASSWORD_LENGTH:
        return error_response('VALIDATION_ERROR', f'Password must be at least {MIN_PASSWORD_LENGTH} characters.', 422)

    if current_password == new_password:
        return error_response('VALIDATION_ERROR', 'New password must be different from current password.', 422)

    # Invalidate current access token
    jwt_data = get_jwt()
    jti = jwt_data.get('jti')
    if jti:
        db.session.add(TokenBlocklist(jti=jti, token_type=jwt_data.get('type', 'access')))

    user.password_hash = generate_password_hash(new_password)
    log_action('PASSWORD_CHANGED', 'User', user.id, actor_id=user.id)
    db.session.commit()

    new_access_token = create_access_token(identity=str(user.id))
    return success_response(
        data={'access_token': new_access_token, 'user': user.to_dict(include_email=True)},
        message='Password updated successfully.'
    )


@auth_bp.post('/logout')
@jwt_required(verify_type=False)
def logout():
    jwt_data = get_jwt()
    jti = jwt_data['jti']
    token_type = jwt_data['type']

    db.session.add(TokenBlocklist(jti=jti, token_type=token_type))
    uid = get_jwt_identity()
    log_action('LOGOUT', 'User', uid, actor_id=int(uid) if uid else None)
    db.session.commit()

    return success_response(message='Logged out successfully.')


@auth_bp.get('/me')
@jwt_required()
def me():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user:
        return error_response('UNAUTHORIZED', 'User not found.', 401)
    return success_response(data={'user': user.to_dict(include_email=True)})
