"""Anomaly analysis routes."""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.models import AnomalyResult, FinancialRecord, ModelVersion, ModelRun
from app.ml.anomaly_detector import run_analysis, train_model, load_model
from app.utils import success_response, error_response, paginate_query
from app.auth import require_active_user, require_role
from app.services import log_action

anomalies_bp = Blueprint('anomalies', __name__)


@anomalies_bp.post('/analyze')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst')
def analyze():
    """Run anomaly analysis on all financial records."""
    uid = int(get_jwt_identity())
    records = FinancialRecord.query.all()

    if len(records) < 3:
        return error_response('INSUFFICIENT_DATA',
                              'At least 3 financial records are required for analysis.', 400)

    try:
        results = run_analysis(records, user_id=uid)
        log_action('ANALYSIS_COMPLETED', 'AnomalyResult', None,
                   {'records_analyzed': len(records), 'anomalies': sum(1 for r in results if r.get('is_anomaly'))})
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return error_response('ANALYSIS_FAILED', f'Analysis failed: {str(e)}', 500)

    return success_response(
        data=results,
        message=f'Analysis complete. {len(records)} records analyzed.',
    )


@anomalies_bp.get('/')
@jwt_required()
@require_active_user()
def list_anomalies():
    """List anomaly results with filters."""
    query = AnomalyResult.query

    risk_level = request.args.get('risk_level')
    if risk_level:
        query = query.filter(AnomalyResult.risk_level == risk_level)

    anomaly_only = request.args.get('anomaly_only', 'false').lower() == 'true'
    if anomaly_only:
        query = query.filter(AnomalyResult.is_anomaly == True)

    record_id = request.args.get('record_id')
    if record_id:
        query = query.filter(AnomalyResult.financial_record_id == int(record_id))

    query = query.order_by(AnomalyResult.created_at.desc())
    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)


@anomalies_bp.get('/<int:anomaly_id>')
@jwt_required()
@require_active_user()
def get_anomaly(anomaly_id):
    ar = db.session.get(AnomalyResult, anomaly_id)
    if not ar:
        return error_response('NOT_FOUND', 'Anomaly result not found.', 404)

    data = ar.to_dict()
    if ar.financial_record:
        data['financial_record'] = ar.financial_record.to_dict()
    return success_response(data=data)


@anomalies_bp.get('/latest')
@jwt_required()
@require_active_user()
def latest_results():
    """Return the latest anomaly result for each financial record."""
    from sqlalchemy import func

    subq = db.session.query(
        AnomalyResult.financial_record_id,
        func.max(AnomalyResult.id).label('max_id'),
    ).group_by(AnomalyResult.financial_record_id).subquery()

    query = AnomalyResult.query.join(
        subq, AnomalyResult.id == subq.c.max_id
    ).order_by(AnomalyResult.risk_score.desc())

    items = [ar.to_dict() for ar in query.all()]
    return success_response(data=items)


@anomalies_bp.get('/models')
@jwt_required()
@require_active_user()
def list_models():
    """List model versions."""
    models = ModelVersion.query.order_by(ModelVersion.created_at.desc()).all()
    return success_response(data=[m.to_dict() for m in models])


@anomalies_bp.get('/runs')
@jwt_required()
@require_active_user()
def list_runs():
    """List analysis runs."""
    runs = ModelRun.query.order_by(ModelRun.created_at.desc()).limit(20).all()
    return success_response(data=[r.to_dict() for r in runs])


@anomalies_bp.post('/train')
@jwt_required()
@require_role('Admin')
def retrain():
    """Force retrain the model."""
    uid = int(get_jwt_identity())
    records = FinancialRecord.query.all()

    if len(records) < 3:
        return error_response('INSUFFICIENT_DATA',
                              'At least 3 records are required for training.', 400)

    try:
        mv = train_model(records)
        log_action('MODEL_TRAINED', 'ModelVersion', mv.version,
                   {'records': len(records)}, actor_id=uid)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return error_response('TRAINING_FAILED', str(e), 500)

    return success_response(data=mv.to_dict(), message='Model trained successfully.')
