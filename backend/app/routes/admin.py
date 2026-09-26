"""Admin routes — user management, audit logs, settings."""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import User, AuditLog, ModelVersion, SystemSetting
from app.utils import success_response, error_response, paginate_query
from app.auth import require_role
from app.services import log_action

admin_bp = Blueprint('admin', __name__)


@admin_bp.get('/users')
@jwt_required()
@require_role('Admin', 'Manager')
def list_users():
    query = User.query.order_by(User.created_at.desc())
    q = request.args.get('q', '').strip()
    if q:
        like = f'%{q}%'
        query = query.filter(db.or_(User.name.ilike(like), User.email.ilike(like)))

    role = request.args.get('role')
    if role:
        query = query.filter(User.role == role)

    items, meta = paginate_query(query, lambda u: u.to_dict(include_email=True))
    return success_response(data=items, meta=meta)


@admin_bp.patch('/users/<int:user_id>')
@jwt_required()
@require_role('Admin')
def update_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return error_response('NOT_FOUND', 'User not found.', 404)

    d = request.get_json(silent=True) or {}
    uid = int(get_jwt_identity())

    if 'role' in d:
        new_role = d['role']
        if new_role not in User.VALID_ROLES:
            return error_response('VALIDATION_ERROR',
                                  f'Invalid role. Valid: {", ".join(User.VALID_ROLES)}', 400)
        old_role = user.role
        user.role = new_role
        log_action('ROLE_CHANGED', 'User', user.id,
                   {'old_role': old_role, 'new_role': new_role}, actor_id=uid)

    if 'is_active' in d:
        user.is_active = bool(d['is_active'])
        log_action('USER_STATUS_CHANGED', 'User', user.id,
                   {'is_active': user.is_active}, actor_id=uid)

    if 'name' in d:
        user.name = d['name']

    db.session.commit()
    return success_response(data=user.to_dict(include_email=True), message='User updated.')


@admin_bp.get('/audit-logs')
@jwt_required()
@require_role('Admin', 'Auditor')
def list_audit_logs():
    query = AuditLog.query.order_by(AuditLog.created_at.desc())

    action = request.args.get('action')
    if action:
        query = query.filter(AuditLog.action == action)

    resource_type = request.args.get('resource_type')
    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)

    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)


@admin_bp.get('/models')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst')
def list_model_versions():
    models = ModelVersion.query.order_by(ModelVersion.created_at.desc()).all()
    return success_response(data=[m.to_dict() for m in models])


@admin_bp.get('/settings')
@jwt_required()
@require_role('Admin')
def get_settings():
    settings = SystemSetting.query.all()
    return success_response(data={'settings': {s.key: s.value for s in settings}})


@admin_bp.patch('/settings')
@jwt_required()
@require_role('Admin')
def update_settings():
    d = request.get_json(silent=True) or {}
    if not isinstance(d, dict):
        return error_response('VALIDATION_ERROR', 'Payload must be a JSON object.', 400)
    settings_dict = d.get('settings', d)
    if not isinstance(settings_dict, dict):
        return error_response('VALIDATION_ERROR', 'Settings must be a key-value dictionary.', 400)

    uid = int(get_jwt_identity())

    for key, value in settings_dict.items():
        setting = SystemSetting.query.filter_by(key=key).first()
        if setting:
            setting.value = str(value)
            setting.updated_by = uid
        else:
            db.session.add(SystemSetting(key=key, value=str(value), updated_by=uid))

    log_action('SETTINGS_CHANGED', 'SystemSetting', None,
               {'keys': list(settings_dict.keys())}, actor_id=uid)
    db.session.commit()
    all_settings = SystemSetting.query.all()
    return success_response(data={'settings': {s.key: s.value for s in all_settings}}, message='Settings updated.')
