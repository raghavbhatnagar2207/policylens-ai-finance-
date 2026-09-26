"""Health probes, correlation IDs, and sanitized error responses."""

def test_health_endpoint(client):
    res = client.get('/api/v1/health')
    assert res.status_code == 200
    assert res.get_json()['status'] == 'ok'
    assert 'X-Request-ID' in res.headers


def test_readiness_endpoint(client):
    res = client.get('/api/v1/ready')
    assert res.status_code == 200
    assert res.get_json()['status'] == 'ready'
    assert res.get_json()['database'] == 'connected'


def test_request_correlation_id_forwarded(client):
    custom_id = 'test-req-correlation-id-12345'
    res = client.get('/api/v1/health', headers={'X-Request-ID': custom_id})
    assert res.status_code == 200
    assert res.headers.get('X-Request-ID') == custom_id
