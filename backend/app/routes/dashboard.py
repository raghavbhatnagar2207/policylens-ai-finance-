"""Dashboard routes — computed summaries from the database."""

from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.extensions import db
from app.models import FinancialRecord, AnomalyResult, RiskCase, Complaint
from app.utils import success_response
from app.auth import require_active_user

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.get('/summary')
@jwt_required()
@require_active_user()
def summary():
    """Return dashboard KPIs computed from the database."""

    # Financial overview
    fin_stats = db.session.query(
        func.count(FinancialRecord.id),
        func.coalesce(func.sum(FinancialRecord.allocation), 0),
        func.coalesce(func.sum(FinancialRecord.utilization), 0),
        func.coalesce(func.avg(FinancialRecord.delay_days), 0),
    ).first()

    record_count = fin_stats[0] or 0
    total_allocated = float(fin_stats[1])
    total_utilized = float(fin_stats[2])
    avg_delay = round(float(fin_stats[3]), 1)
    utilization_pct = round((total_utilized / total_allocated * 100), 1) if total_allocated else 0

    # Risk overview — latest anomaly result per record
    subq = db.session.query(
        AnomalyResult.financial_record_id,
        func.max(AnomalyResult.id).label('max_id'),
    ).group_by(AnomalyResult.financial_record_id).subquery()

    latest_results = db.session.query(AnomalyResult).join(
        subq, AnomalyResult.id == subq.c.max_id
    ).all()

    anomaly_count = sum(1 for r in latest_results if r.is_anomaly)
    risk_counts = {'Low': 0, 'Medium': 0, 'High': 0, 'Critical': 0}
    for r in latest_results:
        level = r.risk_level or 'Low'
        if level in risk_counts:
            risk_counts[level] += 1

    # Cases
    open_cases = RiskCase.query.filter(
        RiskCase.status.notin_(['Resolved', 'Closed'])
    ).count()

    # Complaints
    open_complaints = Complaint.query.filter(
        Complaint.status.notin_(['Resolved', 'Closed', 'Rejected'])
    ).count()

    # Regional breakdown
    region_stats = db.session.query(
        FinancialRecord.region,
        func.count(FinancialRecord.id),
        func.sum(FinancialRecord.allocation),
        func.sum(FinancialRecord.utilization),
        func.avg(FinancialRecord.delay_days),
    ).group_by(FinancialRecord.region).all()

    regions = []
    for row in region_stats:
        alloc = float(row[2] or 0)
        util = float(row[3] or 0)
        regions.append({
            'region': row[0],
            'record_count': row[1],
            'allocation': alloc,
            'utilization': util,
            'utilization_rate': round(util / alloc * 100, 1) if alloc else 0,
            'avg_delay': round(float(row[4] or 0), 1),
        })

    # Monthly trend (from record dates) - PostgreSQL & SQLite compatible
    trends = []
    try:
        dialect_name = 'sqlite'
        try:
            dialect_name = db.engine.dialect.name
        except Exception:
            pass

        if dialect_name == 'postgresql':
            month_expr = func.to_char(FinancialRecord.date, 'YYYY-MM').label('month')
        else:
            month_expr = func.strftime('%Y-%m', FinancialRecord.date).label('month')

        monthly = db.session.query(
            month_expr,
            func.sum(FinancialRecord.allocation),
            func.sum(FinancialRecord.utilization),
            func.count(FinancialRecord.id),
        ).filter(
            FinancialRecord.date.isnot(None)
        ).group_by(month_expr).order_by(month_expr).all()

        trends = [{
            'month': str(row[0]),
            'allocation': float(row[1] or 0),
            'utilization': float(row[2] or 0),
            'records': row[3],
        } for row in monthly]
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to compute monthly trends: %s", e)
        trends = []

    return success_response(data={
        'financial': {
            'total_allocated': total_allocated,
            'total_utilized': total_utilized,
            'utilization_pct': utilization_pct,
            'avg_delay': avg_delay,
            'record_count': record_count,
        },
        'risk': {
            'anomaly_count': anomaly_count,
            'risk_distribution': risk_counts,
            'open_cases': open_cases,
        },
        'complaints': {
            'open_count': open_complaints,
        },
        'regions': regions,
        'trends': trends,
    })
