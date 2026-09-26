"""Notification routes."""

from flask import Blueprint
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import Notification
from app.utils import success_response, error_response, paginate_query
from app.auth import require_active_user

notifications_bp = Blueprint('notifications', __name__)


@notifications_bp.get('/')
@jwt_required()
@require_active_user()
def list_notifications():
    uid = int(get_jwt_identity())
    query = Notification.query.filter_by(user_id=uid).order_by(Notification.created_at.desc())
    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)


@notifications_bp.get('/unread-count')
@jwt_required()
@require_active_user()
def unread_count():
    uid = int(get_jwt_identity())
    count = Notification.query.filter_by(user_id=uid, is_read=False).count()
    return success_response(data={'count': count})


@notifications_bp.patch('/<int:nid>/read')
@jwt_required()
@require_active_user()
def mark_read(nid):
    uid = int(get_jwt_identity())
    n = Notification.query.filter_by(id=nid, user_id=uid).first()
    if not n:
        return error_response('NOT_FOUND', 'Notification not found.', 404)
    n.is_read = True
    db.session.commit()
    return success_response(message='Marked as read.')


@notifications_bp.post('/mark-all-read')
@jwt_required()
@require_active_user()
def mark_all_read():
    uid = int(get_jwt_identity())
    Notification.query.filter_by(user_id=uid, is_read=False).update({'is_read': True})
    db.session.commit()
    return success_response(message='All notifications marked as read.')
