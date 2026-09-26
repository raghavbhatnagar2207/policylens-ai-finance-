"""Case management routes with workflow transitions and BOLA authorization."""

import uuid
from datetime import datetime, timezone
from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import RiskCase, CaseEvent, FinancialRecord, User, Notification
from app.utils import success_response, error_response, paginate_query
from app.auth import (
    require_active_user, require_role, get_current_user,
    can_view_case, can_edit_case,
)
from app.services import log_action

cases_bp = Blueprint('cases', __name__)


@cases_bp.get('/')
@jwt_required()
@require_active_user()
def list_cases():
    user = get_current_user()
    query = RiskCase.query

    # BOLA: Reviewer only sees assigned cases or unassigned queue
    if user.role == 'Reviewer':
        query = query.filter(db.or_(RiskCase.assigned_to == user.id, RiskCase.assigned_to.is_(None)))

    status = request.args.get('status')
    if status:
        query = query.filter(RiskCase.status == status)

    risk_level = request.args.get('risk_level')
    if risk_level:
        query = query.filter(RiskCase.risk_level == risk_level)

    priority = request.args.get('priority')
    if priority:
        query = query.filter(RiskCase.priority == priority)

    assigned = request.args.get('assigned_to')
    if assigned:
        if assigned == 'me':
            assigned = user.id
        query = query.filter(RiskCase.assigned_to == int(assigned))

    q = request.args.get('q', '').strip()
    if q:
        like = f'%{q}%'
        query = query.filter(db.or_(
            RiskCase.case_number.ilike(like),
            RiskCase.title.ilike(like),
        ))

    sort = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    sort_col = getattr(RiskCase, sort, RiskCase.created_at)
    query = query.order_by(sort_col.desc() if order == 'desc' else sort_col.asc())

    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)


@cases_bp.get('/<int:case_id>')
@jwt_required()
@require_active_user()
def get_case(case_id):
    user = get_current_user()
    case = db.session.get(RiskCase, case_id)
    if not case:
        return error_response('NOT_FOUND', 'Case not found.', 404)

    if not can_view_case(user, case):
        return error_response('FORBIDDEN', 'You do not have permission to view this case.', 403)

    data = case.to_dict(include_events=True)

    if case.financial_record:
        data['financial_record'] = case.financial_record.to_dict(include_latest_anomaly=True)
    if case.anomaly_result:
        data['anomaly'] = case.anomaly_result.to_dict()

    return success_response(data=data)


@cases_bp.post('/')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst')
def create_case():
    d = request.get_json(silent=True) or {}
    uid = int(get_jwt_identity())

    fr_id = d.get('financial_record_id') or d.get('record_id')
    if not fr_id:
        return error_response('VALIDATION_ERROR', 'financial_record_id or record_id is required.', 400)

    fr = db.session.get(FinancialRecord, fr_id)
    if not fr:
        return error_response('NOT_FOUND', 'Financial record not found.', 404)

    case_num = f"RC-{fr.record_id}-{uuid.uuid4().hex[:6].upper()}"

    case = RiskCase(
        case_number=case_num,
        financial_record_id=fr.id,
        anomaly_result_id=d.get('anomaly_result_id'),
        risk_level=d.get('risk_level', 'Medium'),
        risk_score=d.get('risk_score'),
        title=d.get('title', f'Review: {fr.region} — {fr.record_id}'),
        description=d.get('description', ''),
        priority=d.get('priority', 'Medium'),
        status='New',
    )
    db.session.add(case)
    db.session.flush()

    event = CaseEvent(
        case_id=case.id,
        actor_id=uid,
        action='CASE_CREATED',
        comment=d.get('description', 'Case created'),
    )
    db.session.add(event)
    log_action('CASE_CREATED', 'RiskCase', case.case_number)
    db.session.commit()

    return success_response(data=case.to_dict(), status=201, message='Case created.')


@cases_bp.patch('/<int:case_id>')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst', 'Reviewer')
def update_case(case_id):
    user = get_current_user()
    case = db.session.get(RiskCase, case_id)
    if not case:
        return error_response('NOT_FOUND', 'Case not found.', 404)

    if not can_edit_case(user, case):
        return error_response('FORBIDDEN', 'You do not have permission to modify this case.', 403)

    d = request.get_json(silent=True) or {}
    uid = user.id

    # Status transition validation
    if 'status' in d:
        new_status = d['status']
        if new_status not in RiskCase.VALID_STATUSES:
            return error_response('VALIDATION_ERROR',
                                  f'Invalid status. Valid: {", ".join(RiskCase.VALID_STATUSES)}', 400)
        if new_status != case.status:
            allowed = RiskCase.VALID_TRANSITIONS.get(case.status, set())
            if user.role not in ('Admin', 'Manager') and new_status not in allowed:
                return error_response('INVALID_STATE_TRANSITION',
                                      f'Cannot transition case from {case.status} to {new_status}. Allowed: {", ".join(allowed)}', 400)

            if new_status in (RiskCase.STATUS_RESOLVED, RiskCase.STATUS_CLOSED):
                res = d.get('resolution') or case.resolution
                if not res or not res.strip():
                    return error_response('VALIDATION_ERROR', 'Resolution explanation is required when resolving or closing a case.', 400)

            event = CaseEvent(
                case_id=case.id, actor_id=uid, action='STATUS_CHANGED',
                field_changed='status', old_value=case.status, new_value=new_status,
                comment=d.get('comment', f'Status transitioned to {new_status}')
            )
            db.session.add(event)
            old_status = case.status
            case.status = new_status

            # Notification on status transition
            if case.assigned_to and case.assigned_to != uid:
                notif = Notification(
                    user_id=case.assigned_to,
                    title=f'Case Status Updated: {case.case_number}',
                    message=f'Case status transitioned from {old_status} to {new_status}.',
                    type='info',
                    resource_type='RiskCase',
                    resource_id=case.case_number,
                )
                db.session.add(notif)

    # Priority
    if 'priority' in d:
        new_priority = d['priority']
        if new_priority not in RiskCase.VALID_PRIORITIES:
            return error_response('VALIDATION_ERROR', 'Invalid priority.', 400)
        if new_priority != case.priority:
            event = CaseEvent(
                case_id=case.id, actor_id=uid, action='PRIORITY_CHANGED',
                field_changed='priority', old_value=case.priority, new_value=new_priority,
            )
            db.session.add(event)
            case.priority = new_priority

    # Assignment
    if 'assigned_to' in d:
        assignee_id = d['assigned_to']
        if assignee_id:
            assignee = db.session.get(User, assignee_id)
            if not assignee:
                return error_response('NOT_FOUND', 'Assignee not found.', 404)
        old_name = case.assignee.name if case.assignee else 'Unassigned'
        case.assigned_to = assignee_id
        new_name = db.session.get(User, assignee_id).name if assignee_id else 'Unassigned'
        event = CaseEvent(
            case_id=case.id, actor_id=uid, action='CASE_ASSIGNED',
            field_changed='assigned_to', old_value=old_name, new_value=new_name,
        )
        db.session.add(event)
        if case.status == 'New':
            case.status = 'Assigned'

        if assignee_id and assignee_id != uid:
            notif = Notification(
                user_id=assignee_id,
                title=f'Case Assigned: {case.case_number}',
                message=f'You have been assigned to investigate case {case.case_number} ({case.title}).',
                type='info',
                resource_type='RiskCase',
                resource_id=case.case_number,
            )
            db.session.add(notif)

    # Resolution
    if 'resolution' in d:
        case.resolution = d['resolution']
        case.resolution_code = d.get('resolution_code')

    # Comment / note
    comment = d.get('comment')
    if comment and not d.get('status'):
        event = CaseEvent(
            case_id=case.id, actor_id=uid, action='NOTE_ADDED',
            comment=comment,
        )
        db.session.add(event)

    log_action('CASE_UPDATED', 'RiskCase', case.case_number)
    db.session.commit()

    return success_response(data=case.to_dict(include_events=True), message='Case updated.')


@cases_bp.get('/<int:case_id>/events')
@jwt_required()
@require_active_user()
def case_events(case_id):
    user = get_current_user()
    case = db.session.get(RiskCase, case_id)
    if not case:
        return error_response('NOT_FOUND', 'Case not found.', 404)

    if not can_view_case(user, case):
        return error_response('FORBIDDEN', 'You do not have permission to view this case.', 403)

    events = CaseEvent.query.filter_by(case_id=case.id).order_by(
        CaseEvent.created_at.desc()
    ).limit(100).all()

    return success_response(data=[e.to_dict() for e in events])


@cases_bp.post('/<int:case_id>/events')
@jwt_required()
@require_active_user()
def add_case_event(case_id):
    user = get_current_user()
    case = db.session.get(RiskCase, case_id)
    if not case:
        return error_response('NOT_FOUND', 'Case not found.', 404)

    if not can_edit_case(user, case):
        return error_response('FORBIDDEN', 'You do not have permission to add notes to this case.', 403)

    d = request.get_json(silent=True) or {}
    comment = d.get('comment')
    if not comment:
        return error_response('VALIDATION_ERROR', 'Comment is required.', 400)

    event = CaseEvent(
        case_id=case.id,
        actor_id=user.id,
        action=d.get('action', 'NOTE_ADDED'),
        comment=comment,
    )
    db.session.add(event)
    db.session.commit()
    return success_response(data=event.to_dict(), status=200, message='Event added.')
