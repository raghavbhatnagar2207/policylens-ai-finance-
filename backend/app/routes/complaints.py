"""Complaint routes — submission with NLP analysis, listing, update, and BOLA authorization."""

import uuid
from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db, limiter
from app.models import Complaint, ComplaintEvent, Notification
from app.nlp.processor import analyse as nlp_analyse
from app.utils import success_response, error_response, paginate_query
from app.auth import (
    require_active_user, require_role, get_current_user,
    can_view_complaint, can_edit_complaint,
)
from app.services import log_action

complaints_bp = Blueprint('complaints', __name__)


@complaints_bp.post('/')
@jwt_required()
@require_active_user()
@limiter.limit("10 per minute")
def create_complaint():
    d = request.get_json(silent=True) or {}
    text = (d.get('text') or '').strip()

    if not text or len(text) < 10:
        return error_response('VALIDATION_ERROR', 'Complaint text must be at least 10 characters.', 400)
    if len(text) > 5000:
        return error_response('VALIDATION_ERROR', 'Complaint text must not exceed 5000 characters.', 400)

    uid = int(get_jwt_identity())

    # Run NLP analysis
    nlp_result = nlp_analyse(text)

    # Collision-safe reference ID
    ref_id = f"PL-C{uuid.uuid4().hex[:6].upper()}"

    complaint = Complaint(
        reference_id=ref_id,
        user_text=text,
        language=nlp_result['language'],
        category=nlp_result['category'],
        sentiment=nlp_result['sentiment'],
        urgency=nlp_result['urgency'],
        priority=nlp_result['priority'],
        confidence=nlp_result['confidence'],
        status='Open',
        submitted_by=uid,
    )
    db.session.add(complaint)
    db.session.flush()

    event = ComplaintEvent(
        complaint_id=complaint.id,
        actor_id=uid,
        action='COMPLAINT_CREATED',
        comment='Complaint submitted',
    )
    db.session.add(event)
    log_action('COMPLAINT_CREATED', 'Complaint', ref_id)
    db.session.commit()

    data = complaint.to_dict()
    data['nlp'] = nlp_result
    return success_response(data=data, status=201, message='Complaint submitted.')


@complaints_bp.get('/')
@jwt_required()
@require_active_user()
def list_complaints():
    user = get_current_user()
    query = Complaint.query

    # BOLA: normal users can only view their own submissions; reviewers see assigned or unassigned
    if user.role == 'User':
        query = query.filter(Complaint.submitted_by == user.id)
    elif user.role == 'Reviewer':
        query = query.filter(db.or_(Complaint.assigned_to == user.id, Complaint.assigned_to.is_(None)))

    status = request.args.get('status')
    if status:
        query = query.filter(Complaint.status == status)

    priority = request.args.get('priority')
    if priority:
        query = query.filter(Complaint.priority == priority)

    q = request.args.get('q', '').strip()
    if q:
        like = f'%{q}%'
        query = query.filter(db.or_(
            Complaint.reference_id.ilike(like),
            Complaint.user_text.ilike(like),
            Complaint.category.ilike(like),
        ))

    query = query.order_by(Complaint.created_at.desc())
    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)


@complaints_bp.get('/<int:complaint_id>')
@jwt_required()
@require_active_user()
def get_complaint(complaint_id):
    user = get_current_user()
    c = db.session.get(Complaint, complaint_id)
    if not c:
        return error_response('NOT_FOUND', 'Complaint not found.', 404)

    if not can_view_complaint(user, c):
        return error_response('FORBIDDEN', 'You do not have permission to view this complaint.', 403)

    data = c.to_dict()
    events = ComplaintEvent.query.filter_by(complaint_id=c.id).order_by(
        ComplaintEvent.created_at.desc()
    ).limit(50).all()
    data['events'] = [e.to_dict() for e in events]
    return success_response(data=data)


@complaints_bp.patch('/<int:complaint_id>')
@jwt_required()
@require_role('Admin', 'Manager', 'Reviewer')
def update_complaint(complaint_id):
    user = get_current_user()
    c = db.session.get(Complaint, complaint_id)
    if not c:
        return error_response('NOT_FOUND', 'Complaint not found.', 404)

    if not can_edit_complaint(user, c):
        return error_response('FORBIDDEN', 'You do not have permission to modify this complaint.', 403)

    d = request.get_json(silent=True) or {}
    uid = user.id

    if 'status' in d:
        new_status = d['status']
        if new_status not in Complaint.VALID_STATUSES:
            return error_response('VALIDATION_ERROR',
                                  f'Invalid status. Valid: {", ".join(Complaint.VALID_STATUSES)}', 400)
        if new_status != c.status:
            event = ComplaintEvent(
                complaint_id=c.id, actor_id=uid, action='STATUS_CHANGED',
                comment=f'Status changed from {c.status} to {new_status}',
            )
            db.session.add(event)
            c.status = new_status

    if 'assigned_to' in d:
        assignee_id = d['assigned_to']
        c.assigned_to = assignee_id
        if assignee_id and assignee_id != uid:
            notif = Notification(
                user_id=assignee_id,
                title=f'Complaint Assigned: {c.reference_id}',
                message=f'You have been assigned to handle complaint {c.reference_id} ({c.category}).',
                type='info',
                resource_type='Complaint',
                resource_id=c.reference_id,
            )
            db.session.add(notif)

    if 'resolution' in d:
        c.resolution = d['resolution']

    if 'priority' in d:
        c.priority = d['priority']

    comment = d.get('comment')
    if comment:
        event = ComplaintEvent(
            complaint_id=c.id, actor_id=uid, action='NOTE_ADDED',
            comment=comment,
        )
        db.session.add(event)

    log_action('COMPLAINT_UPDATED', 'Complaint', c.reference_id)
    db.session.commit()

    return success_response(data=c.to_dict(), message='Complaint updated.')
