"""Machine Learning and Anomaly Detection unit tests."""

from app.models import FinancialRecord
from app.ml.anomaly_detector import train_model, run_analysis, _extract_features, FEATURE_NAMES


def test_feature_extraction(client):
    records = FinancialRecord.query.all()
    assert len(records) >= 3
    X = _extract_features(records)
    assert X.shape[0] == len(records)
    assert X.shape[1] == len(FEATURE_NAMES)


def test_train_model_and_persist(client):
    records = FinancialRecord.query.all()
    mv = train_model(records, contamination=0.25)
    assert mv is not None
    assert mv.algorithm == 'IsolationForest'
    assert mv.status == 'Active'
    assert mv.training_records == len(records)


def test_run_analysis_pipeline(client, analyst_headers):
    res = client.post('/api/v1/anomalies/analyze', headers=analyst_headers)
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['success'] is True
    assert len(json_data['data']) >= 3
    for item in json_data['data']:
        assert 'risk_score' in item
        assert 'is_anomaly' in item
        assert 'explanations' in item
        assert len(item['explanations']) > 0
