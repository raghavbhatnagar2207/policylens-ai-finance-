"""Regional analysis routes."""

from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy import func

from app.extensions import db
from app.models import FinancialRecord, AnomalyResult, RiskCase
from app.utils import success_response
from app.auth import require_active_user

regions_bp = Blueprint('regions', __name__)

# Approximate coordinates for demo regions (Western UP, India)
REGION_COORDS = {
    'Moradabad': [28.8386, 78.7733],
    'Rampur': [28.8154, 79.0250],
    'Sambhal': [28.5852, 78.5732],
    'Amroha': [28.9031, 78.4698],
    'Bijnor': [29.3724, 78.1362],
    'Meerut': [28.9845, 77.7064],
    'Bareilly': [28.3670, 79.4304],
    'Lucknow': [26.8467, 80.9462],
    'Agra': [27.1767, 78.0081],
    'Varanasi': [25.3176, 82.9739],
}


@regions_bp.get('/')
@jwt_required()
@require_active_user()
def regional_summary():
    """Compute per-region statistics from the database."""

    # Financial stats per region
    region_fin = db.session.query(
        FinancialRecord.region,
        func.count(FinancialRecord.id),
        func.sum(FinancialRecord.allocation),
        func.sum(FinancialRecord.utilization),
        func.avg(FinancialRecord.delay_days),
        func.avg(FinancialRecord.utilization_rate),
    ).group_by(FinancialRecord.region).all()

    # Anomaly counts per region
    anomaly_counts = db.session.query(
        FinancialRecord.region,
        func.count(AnomalyResult.id),
    ).join(
        AnomalyResult, AnomalyResult.financial_record_id == FinancialRecord.id
    ).filter(
        AnomalyResult.is_anomaly == True
    ).group_by(FinancialRecord.region).all()
    anomaly_map = dict(anomaly_counts)

    # Risk distribution per region
    risk_dist = db.session.query(
        FinancialRecord.region,
        AnomalyResult.risk_level,
        func.count(AnomalyResult.id),
    ).join(
        AnomalyResult, AnomalyResult.financial_record_id == FinancialRecord.id
    ).group_by(FinancialRecord.region, AnomalyResult.risk_level).all()

    risk_map = {}
    for region, level, count in risk_dist:
        if region not in risk_map:
            risk_map[region] = {}
        risk_map[region][level] = count

    # Open cases per region
    case_counts = db.session.query(
        FinancialRecord.region,
        func.count(RiskCase.id),
    ).join(
        RiskCase, RiskCase.financial_record_id == FinancialRecord.id
    ).filter(
        RiskCase.status.notin_(['Resolved', 'Closed'])
    ).group_by(FinancialRecord.region).all()
    case_map = dict(case_counts)

    db_regions = {row[0] for row in region_fin}
    regions = []
    for row in region_fin:
        name = row[0]
        alloc = float(row[2] or 0)
        util = float(row[3] or 0)
        r_dist = risk_map.get(name, {})

        # Compute dominant risk
        dominant = None
        for lvl in ('Critical', 'High', 'Medium', 'Low'):
            if r_dist.get(lvl, 0) > 0:
                dominant = lvl
                break
        if dominant is None and row[1] > 0:
            dominant = 'Low'

        regions.append({
            'region': name,
            'coordinates': REGION_COORDS.get(name),
            'record_count': row[1],
            'allocation': alloc,
            'utilization': util,
            'utilization_rate': round(util / alloc * 100, 1) if alloc else 0,
            'avg_delay': round(float(row[4] or 0), 1),
            'anomaly_count': anomaly_map.get(name, 0),
            'anomalies': anomaly_map.get(name, 0),
            'risk_distribution': r_dist,
            'dominant_risk': dominant,
            'open_cases': case_map.get(name, 0),
            'has_data': True,
        })

    # Include known regions without database records as explicit No Data entries
    for name, coords in REGION_COORDS.items():
        if name not in db_regions:
            regions.append({
                'region': name,
                'coordinates': coords,
                'record_count': 0,
                'allocation': 0.0,
                'utilization': 0.0,
                'utilization_rate': 0.0,
                'avg_delay': 0.0,
                'anomaly_count': 0,
                'anomalies': 0,
                'risk_distribution': {},
                'dominant_risk': None,
                'open_cases': 0,
                'has_data': False,
            })

    return success_response(data=regions)
