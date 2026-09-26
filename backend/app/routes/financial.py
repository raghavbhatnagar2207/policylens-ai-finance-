"""Financial record CRUD with pagination, search, filters, sorting."""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import FinancialRecord
from app.utils import success_response, error_response, paginate_query
from app.auth import require_active_user, require_role
from app.services import log_action

financial_bp = Blueprint('financial', __name__)


def _apply_filters(query):
    """Apply search, filter, and sort query params."""
    # Search
    q = request.args.get('q', '').strip()
    if q:
        like = f'%{q}%'
        query = query.filter(
            db.or_(
                FinancialRecord.record_id.ilike(like),
                FinancialRecord.region.ilike(like),
                FinancialRecord.category.ilike(like),
                FinancialRecord.department.ilike(like),
            )
        )

    # Filters
    region = request.args.get('region')
    if region:
        query = query.filter(FinancialRecord.region == region)

    status = request.args.get('status')
    if status:
        query = query.filter(FinancialRecord.status == status)

    risk = request.args.get('risk')
    if risk:
        # Join with latest anomaly result
        from app.models import AnomalyResult
        from sqlalchemy import func
        subq = db.session.query(
            AnomalyResult.financial_record_id,
            func.max(AnomalyResult.id).label('max_id'),
        ).group_by(AnomalyResult.financial_record_id).subquery()
        latest = db.session.query(AnomalyResult.financial_record_id).join(
            subq, AnomalyResult.id == subq.c.max_id
        ).filter(AnomalyResult.risk_level == risk).subquery()
        query = query.filter(FinancialRecord.id.in_(db.session.query(latest)))

    # Date range
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    if date_from:
        query = query.filter(FinancialRecord.date >= date_from)
    if date_to:
        query = query.filter(FinancialRecord.date <= date_to)

    # Sorting
    sort = request.args.get('sort', 'created_at')
    order = request.args.get('order', 'desc')
    sort_col = getattr(FinancialRecord, sort, FinancialRecord.created_at)
    query = query.order_by(sort_col.desc() if order == 'desc' else sort_col.asc())

    return query


@financial_bp.get('/')
@jwt_required()
@require_active_user()
def list_records():
    query = _apply_filters(FinancialRecord.query)
    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)


@financial_bp.get('/<int:record_id>')
@jwt_required()
@require_active_user()
def get_record(record_id):
    r = db.session.get(FinancialRecord, record_id)
    if not r:
        return error_response('NOT_FOUND', 'Financial record not found.', 404)

    data = r.to_dict()

    # Include latest anomaly result if exists
    from app.models import AnomalyResult
    latest = AnomalyResult.query.filter_by(
        financial_record_id=r.id
    ).order_by(AnomalyResult.created_at.desc()).first()
    if latest:
        data['anomaly'] = latest.to_dict()

    # Include open cases
    from app.models import RiskCase
    cases = RiskCase.query.filter_by(financial_record_id=r.id).order_by(
        RiskCase.created_at.desc()
    ).limit(5).all()
    data['cases'] = [c.to_dict() for c in cases]

    return success_response(data=data)


@financial_bp.post('/')
@jwt_required()
@require_role('Admin', 'Manager')
def create_record():
    d = request.get_json(silent=True) or {}

    required = ['record_id', 'region', 'allocation', 'utilization']
    missing = [f for f in required if not d.get(f)]
    if missing:
        return error_response('VALIDATION_ERROR', f'Missing required fields: {", ".join(missing)}', 400)

    if FinancialRecord.query.filter_by(record_id=d['record_id']).first():
        return error_response('DUPLICATE', 'A record with this ID already exists.', 422)

    try:
        alloc = float(d['allocation'])
        util = float(d['utilization'])
    except (ValueError, TypeError):
        return error_response('VALIDATION_ERROR', 'Allocation and utilization must be numeric.', 400)

    if alloc < 0 or util < 0:
        return error_response('VALIDATION_ERROR', 'Financial amounts cannot be negative.', 400)

    rate = round(util / alloc * 100, 2) if alloc > 0 else 0

    record = FinancialRecord(
        record_id=d['record_id'],
        region=d['region'],
        department=d.get('department'),
        category=d.get('category'),
        allocation=alloc,
        utilization=util,
        utilization_rate=d.get('utilization_rate', rate),
        delay_days=int(d.get('delay_days', 0)),
        transaction_count=int(d.get('transaction_count', 0)),
        historical_average=float(d['historical_average']) if d.get('historical_average') else None,
        fiscal_year=d.get('fiscal_year'),
        quarter=d.get('quarter'),
        date=d.get('date'),
        data_source=d.get('data_source', 'Manual'),
    )
    db.session.add(record)
    log_action('RECORD_CREATED', 'FinancialRecord', d['record_id'])
    db.session.commit()

    return success_response(data=record.to_dict(), status=201, message='Record created.')


@financial_bp.patch('/<int:record_id>')
@jwt_required()
@require_role('Admin', 'Manager')
def update_record(record_id):
    r = db.session.get(FinancialRecord, record_id)
    if not r:
        return error_response('NOT_FOUND', 'Financial record not found.', 404)

    d = request.get_json(silent=True) or {}
    updatable = ['region', 'department', 'category', 'allocation', 'utilization',
                 'delay_days', 'transaction_count', 'status', 'date']

    changes = {}
    for field in updatable:
        if field in d:
            old_val = getattr(r, field)
            setattr(r, field, d[field])
            changes[field] = {'old': str(old_val), 'new': str(d[field])}

    if 'allocation' in d or 'utilization' in d:
        alloc = float(r.allocation or 0)
        util = float(r.utilization or 0)
        r.utilization_rate = round(util / alloc * 100, 2) if alloc > 0 else 0

    log_action('RECORD_UPDATED', 'FinancialRecord', r.record_id, changes)
    db.session.commit()

    return success_response(data=r.to_dict(), message='Record updated.')


@financial_bp.delete('/<int:record_id>')
@jwt_required()
@require_role('Admin')
def delete_record(record_id):
    r = db.session.get(FinancialRecord, record_id)
    if not r:
        return error_response('NOT_FOUND', 'Financial record not found.', 404)

    log_action('RECORD_DELETED', 'FinancialRecord', r.record_id)
    db.session.delete(r)
    db.session.commit()

    return success_response(message='Record deleted.')


@financial_bp.get('/regions')
@jwt_required()
@require_active_user()
def list_regions():
    """Return distinct region names for filter dropdowns."""
    regions = db.session.query(FinancialRecord.region).distinct().order_by(FinancialRecord.region).all()
    return success_response(data=[r[0] for r in regions])


@financial_bp.get('/export')
@jwt_required()
@require_active_user()
def export_csv():
    """Export filtered financial records as CSV."""
    import csv
    import io
    from flask import Response

    records = _apply_filters(FinancialRecord.query).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        'record_id', 'region', 'department', 'category',
        'allocation', 'utilization', 'utilization_rate', 'delay_days',
        'transaction_count', 'historical_average', 'fiscal_year', 'quarter', 'date', 'status',
    ])
    for r in records:
        writer.writerow([
            r.record_id, r.region, r.department, r.category,
            r.allocation, r.utilization, r.utilization_rate, r.delay_days,
            r.transaction_count, r.historical_average, r.fiscal_year, r.quarter,
            r.date.isoformat() if r.date else '', r.status,
        ])

    return Response(
        output.getvalue(),
        mimetype='text/csv',
        headers={
            'Content-Disposition': 'attachment; filename=financial_records.csv',
            'Content-Type': 'text/csv; charset=utf-8',
        },
    )
