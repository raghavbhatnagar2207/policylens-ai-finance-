"""Admin settings canonical contract and RBAC tests."""

def test_admin_settings_get_canonical_contract(client, admin_headers):
    res = client.get('/api/v1/admin/settings', headers=admin_headers)
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['success'] is True
    # Canonical dictionary contract
    assert 'settings' in json_data['data']
    assert isinstance(json_data['data']['settings'], dict)
    assert 'anomaly_contamination' in json_data['data']['settings']


def test_admin_settings_patch_canonical_contract(client, admin_headers):
    patch_res = client.patch('/api/v1/admin/settings', headers=admin_headers, json={
        'settings': {
            'risk_threshold_high': '0.55',
            'anomaly_contamination': '0.12',
        }
    })
    assert patch_res.status_code == 200
    json_data = patch_res.get_json()
    assert json_data['success'] is True
    assert json_data['data']['settings']['risk_threshold_high'] == '0.55'
    assert json_data['data']['settings']['anomaly_contamination'] == '0.12'

    # Verify GET returns updated settings
    get_res = client.get('/api/v1/admin/settings', headers=admin_headers)
    assert get_res.get_json()['data']['settings']['risk_threshold_high'] == '0.55'


def test_analyst_cannot_patch_settings(client, analyst_headers):
    patch_res = client.patch('/api/v1/admin/settings', headers=analyst_headers, json={
        'settings': {'risk_threshold_high': '0.99'}
    })
    assert patch_res.status_code == 403
    assert patch_res.get_json()['error']['code'] == 'FORBIDDEN'
