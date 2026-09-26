"""ML anomaly detection pipeline.

Separates training from inference. Uses Isolation Forest with proper
feature engineering, model persistence, and per-feature explanations.
"""

import json
import os
import time
import uuid
import logging
from datetime import datetime, timezone

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib

from app.extensions import db
from app.models import (
    FinancialRecord, AnomalyResult, ModelVersion, ModelRun,
    RiskCase, Notification,
)

logger = logging.getLogger(__name__)

FEATURE_NAMES = [
    'allocation', 'utilization', 'utilization_rate',
    'delay_days', 'transaction_count',
]

DEFAULT_CONFIG = {
    'contamination': 0.10,
    'n_estimators': 100,
    'random_state': 42,
    'max_samples': 'auto',
}

# Risk thresholds
RISK_THRESHOLDS = {
    'critical_score': -0.3,
    'high_score': -0.15,
    'medium_score': -0.05,
    'delay_high': 20,
    'utilization_low': 40.0,
}


def _extract_features(records):
    """Extract ML feature matrix from financial records."""
    X = []
    for r in records:
        X.append([
            float(r.allocation or 0),
            float(r.utilization or 0),
            float(r.utilization_rate or 0),
            float(r.delay_days or 0),
            float(r.transaction_count or 0),
        ])
    return np.array(X)


def _compute_baselines(X):
    """Compute per-feature baselines (median and std) for explanations."""
    return {
        'median': np.median(X, axis=0).tolist(),
        'mean': np.mean(X, axis=0).tolist(),
        'std': np.std(X, axis=0).tolist(),
    }


def _generate_explanations(record, features_row, baselines, anomaly_score, is_anomaly):
    """Generate per-feature explanations comparing observed vs baseline."""
    explanations = []
    labels = ['Allocation (₹K)', 'Utilization (₹K)', 'Utilization Rate (%)',
              'Processing Delay (days)', 'Transaction Count']
    units = ['₹K', '₹K', '%', 'days', 'transactions']

    for i, (name, label, unit) in enumerate(zip(FEATURE_NAMES, labels, units)):
        observed = features_row[i]
        baseline = baselines['median'][i]
        std = baselines['std'][i]
        deviation = observed - baseline

        # Calculate relative contribution
        contribution = 'neutral'
        if std > 0:
            z_score = abs(deviation) / std
            if z_score > 2.0:
                contribution = 'strong'
            elif z_score > 1.0:
                contribution = 'moderate'

        explanations.append({
            'feature': name,
            'label': label,
            'observed': round(observed, 2),
            'baseline': round(baseline, 2),
            'deviation': round(deviation, 2),
            'unit': unit,
            'contribution': contribution,
        })

    return explanations


def _compute_risk_level(anomaly_score, is_anomaly, record, baselines):
    """Hybrid risk scoring: ML signal + business rules + peer comparison."""
    score = 0.0
    signals = []

    # 1) ML anomaly signal (weight: 40%)
    if is_anomaly:
        if anomaly_score < RISK_THRESHOLDS['critical_score']:
            score += 0.40
            signals.append('Strong anomaly signal from ML model')
        elif anomaly_score < RISK_THRESHOLDS['high_score']:
            score += 0.30
            signals.append('Moderate anomaly signal from ML model')
        else:
            score += 0.20
            signals.append('Weak anomaly signal from ML model')
    else:
        score += 0.0

    # 2) Business rule: processing delay (weight: 25%)
    delay = float(record.delay_days or 0)
    if delay > 30:
        score += 0.25
        signals.append(f'Processing delay of {int(delay)} days significantly exceeds threshold')
    elif delay > RISK_THRESHOLDS['delay_high']:
        score += 0.15
        signals.append(f'Processing delay of {int(delay)} days exceeds threshold')
    elif delay > 10:
        score += 0.05

    # 3) Utilization deviation (weight: 20%)
    util_rate = float(record.utilization_rate or 0)
    median_rate = baselines['median'][2]
    if util_rate < RISK_THRESHOLDS['utilization_low'] and median_rate > 50:
        score += 0.20
        signals.append(f'Utilization rate {util_rate:.1f}% significantly below peer median {median_rate:.1f}%')
    elif abs(util_rate - median_rate) > 25:
        score += 0.10
        signals.append(f'Utilization rate deviates from peer median by {abs(util_rate - median_rate):.1f} pp')

    # 4) Historical deviation (weight: 15%)
    if record.historical_average and float(record.historical_average) > 0:
        hist_dev = abs(float(record.utilization) - float(record.historical_average)) / float(record.historical_average)
        if hist_dev > 0.5:
            score += 0.15
            signals.append('Significant deviation from historical average')
        elif hist_dev > 0.25:
            score += 0.08

    # Determine level
    if score >= 0.60:
        level = 'Critical'
    elif score >= 0.40:
        level = 'High'
    elif score >= 0.20:
        level = 'Medium'
    else:
        level = 'Low'

    return level, round(score, 3), signals


def resolve_artifact_path(artifact_ref):
    """Resolve a portable artifact key to a physical filesystem path.
    Prevents storage of machine-specific absolute paths.
    """
    from flask import current_app
    folder = current_app.config.get('ML_ARTIFACT_FOLDER', os.path.join(os.path.dirname(__file__), 'artifacts'))
    if not artifact_ref:
        return None
    if os.path.isabs(artifact_ref):
        if os.path.exists(artifact_ref):
            return artifact_ref
        basename = os.path.basename(artifact_ref)
        fallback = os.path.join(folder, basename)
        if os.path.exists(fallback):
            return fallback
    clean_ref = os.path.normpath(artifact_ref).lstrip('\\/').replace('\\', '/')
    return os.path.join(folder, clean_ref)


def train_model(records=None, config=None, contamination=None):
    """Train (or retrain) the Isolation Forest model and persist the artifact.

    Returns the ModelVersion record.
    """
    if records is None:
        records = FinancialRecord.query.all()

    if len(records) < 3:
        raise ValueError('Insufficient data for training. Need at least 3 records.')

    cfg = {**DEFAULT_CONFIG, **(config or {})}
    if contamination is not None:
        cfg['contamination'] = contamination
    X = _extract_features(records)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        contamination=cfg['contamination'],
        n_estimators=cfg['n_estimators'],
        random_state=cfg['random_state'],
        max_samples=cfg['max_samples'],
    )
    model.fit(X_scaled)

    # Collision-safe version tag
    version_id = uuid.uuid4().hex[:6].upper()
    version_tag = f"IF-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{version_id}"
    artifact_key = f"models/IF/{version_tag}/model.joblib"
    full_path = resolve_artifact_path(artifact_key)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)

    artifact = {
        'model': model,
        'scaler': scaler,
        'feature_names': FEATURE_NAMES,
        'baselines': _compute_baselines(X),
        'config': cfg,
        'training_samples': len(records),
    }
    joblib.dump(artifact, full_path)

    # Real evaluation metadata (no fake stats)
    metrics = {
        'training_samples': len(records),
        'features_count': len(FEATURE_NAMES),
        'contamination_rate': cfg['contamination'],
        'n_estimators': cfg['n_estimators'],
        'trained_at': datetime.now(timezone.utc).isoformat(),
    }

    # Deactivate previous versions
    ModelVersion.query.filter_by(status='Active').update({'status': 'Archived'})

    mv = ModelVersion(
        version=version_tag,
        algorithm='IsolationForest',
        features=json.dumps(FEATURE_NAMES),
        config=json.dumps(cfg),
        training_records=len(records),
        artifact_path=artifact_key,  # Store portable relative reference!
        metrics=json.dumps(metrics),
        status='Active',
    )
    db.session.add(mv)
    db.session.flush()

    logger.info(f'Trained model {version_tag} on {len(records)} records')
    return mv


def load_model():
    """Load the active model artifact. Returns (artifact_dict, ModelVersion) or (None, None)."""
    mv = ModelVersion.query.filter_by(status='Active').order_by(ModelVersion.created_at.desc()).first()
    if mv is None or not mv.artifact_path:
        return None, None
    full_path = resolve_artifact_path(mv.artifact_path)
    if not full_path or not os.path.exists(full_path):
        return None, None
    try:
        artifact = joblib.load(full_path)
        return artifact, mv
    except Exception as e:
        logger.error(f'Failed to load model artifact from {full_path}: {e}')
        return None, None


def run_analysis(records=None, user_id=None):
    """Run anomaly detection on financial records.

    1. Load (or train) model
    2. Score each record
    3. Generate explanations
    4. Compute hybrid risk level
    5. Persist AnomalyResult rows
    6. Auto-create cases for high/critical risk

    Returns list of result dicts.
    """
    start = time.time()

    if records is None:
        records = FinancialRecord.query.all()

    if not records:
        return []

    # Load or train model
    artifact, mv = load_model()
    if artifact is None:
        mv = train_model(records)
        db.session.flush()
        artifact = joblib.load(resolve_artifact_path(mv.artifact_path))

    model = artifact['model']
    scaler = artifact['scaler']
    baselines = artifact['baselines']

    X = _extract_features(records)
    X_scaled = scaler.transform(X)

    scores = model.decision_function(X_scaled)
    predictions = model.predict(X_scaled)

    # Create model run record
    run = ModelRun(
        model_version_id=mv.id,
        records_analyzed=len(records),
        triggered_by=user_id,
        status='Completed',
    )
    db.session.add(run)
    db.session.flush()

    results = []
    anomaly_count = 0

    for i, record in enumerate(records):
        anomaly_score = float(scores[i])
        is_anomaly = bool(predictions[i] == -1)

        explanations = _generate_explanations(
            record, X[i], baselines, anomaly_score, is_anomaly
        )
        risk_level, risk_score, risk_signals = _compute_risk_level(
            anomaly_score, is_anomaly, record, baselines
        )

        if is_anomaly:
            anomaly_count += 1

        ar = AnomalyResult(
            financial_record_id=record.id,
            model_version=mv.version,
            anomaly_score=anomaly_score,
            is_anomaly=is_anomaly,
            risk_level=risk_level,
            risk_score=risk_score,
            features=json.dumps({
                'values': X[i].tolist(),
                'names': FEATURE_NAMES,
            }),
            explanations=json.dumps(explanations),
            model_run_id=run.id,
        )
        db.session.add(ar)
        db.session.flush()

        # Auto-create case for High/Critical if not already open
        if risk_level in ('High', 'Critical'):
            existing_open = RiskCase.query.filter(
                RiskCase.financial_record_id == record.id,
                RiskCase.status.notin_(['Resolved', 'Closed']),
            ).first()
            if not existing_open:
                case_uid = uuid.uuid4().hex[:6].upper()
                case_num = f"RC-{record.record_id}-{case_uid}"
                case = RiskCase(
                    case_number=case_num,
                    financial_record_id=record.id,
                    anomaly_result_id=ar.id,
                    risk_level=risk_level,
                    risk_score=risk_score,
                    status='New',
                    priority='High' if risk_level == 'Critical' else 'Medium',
                    title=f'Risk alert: {record.region} — {record.record_id}',
                    description='; '.join(risk_signals) if risk_signals else 'Anomaly detected by ML model',
                )
                db.session.add(case)
                db.session.flush()

                # Generate notification event for administrators and managers
                from app.models import User
                for u in User.query.filter(User.role.in_(['Admin', 'Manager'])).all():
                    notif = Notification(
                        user_id=u.id,
                        title=f'High Risk Case Created: {case.case_number}',
                        message=f'Record {record.record_id} in {record.region} flagged at {risk_level} risk level.',
                        type='warning' if risk_level == 'High' else 'danger',
                        resource_type='RiskCase',
                        resource_id=case.case_number,
                    )
                    db.session.add(notif)

        result_dict = ar.to_dict()
        result_dict['risk_signals'] = risk_signals
        results.append(result_dict)

    duration = time.time() - start
    run.anomalies_found = anomaly_count
    run.duration_seconds = round(duration, 2)

    logger.info(f'Analysis complete: {len(records)} records, {anomaly_count} anomalies, {duration:.2f}s')
    return results
