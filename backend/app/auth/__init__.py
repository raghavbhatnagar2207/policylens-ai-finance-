"""Authentication and authorization decorators."""

from functools import wraps
from flask import jsonify
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from app.extensions import db
from app.models import User


def get_current_user():
    """Return the User object for the current JWT identity, or None."""
    try:
        uid = get_jwt_identity()
        if uid is None:
            return None
        return db.session.get(User, int(uid))
    except Exception:
        return None


def require_role(*allowed_roles):
    """Decorator: require the authenticated user to have one of the listed roles.

    Usage::

        @app.route('/admin/users')
        @jwt_required()
        @require_role('Admin', 'Manager')
        def admin_users():
            ...
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if user is None:
                return jsonify(success=False, error={'code': 'UNAUTHORIZED', 'message': 'Authentication required.'}), 401
            if not user.is_active:
                return jsonify(success=False, error={'code': 'ACCOUNT_DISABLED', 'message': 'This account has been deactivated.'}), 403
            if user.role not in allowed_roles:
                return jsonify(success=False, error={'code': 'FORBIDDEN', 'message': 'You do not have permission to perform this action.'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def require_active_user():
    """Decorator: require the authenticated user to be active (not disabled)."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = get_current_user()
            if user is None:
                return jsonify(success=False, error={'code': 'UNAUTHORIZED', 'message': 'Authentication required.'}), 401
            if not user.is_active:
                return jsonify(success=False, error={'code': 'ACCOUNT_DISABLED', 'message': 'This account has been deactivated.'}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator


from app.auth.policies import (
    can_view_financial_record,
    can_edit_financial_record,
    can_view_case,
    can_edit_case,
    can_view_complaint,
    can_edit_complaint,
    can_view_report,
    can_download_report,
    can_view_import,
    can_edit_user,
)
