"""Authentication and RBAC authorization tests."""

def test_login_success(client):
    res = client.post('/api/v1/auth/login', json={
        'email': 'admin@test.local',
        'password': 'AdminPass@123',
    })
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['success'] is True
    assert 'access_token' in json_data['data']
    assert 'refresh_token' in json_data['data']
    assert json_data['data']['user']['email'] == 'admin@test.local'
    assert json_data['data']['user']['role'] == 'Admin'


def test_login_invalid_password(client):
    res = client.post('/api/v1/auth/login', json={
        'email': 'admin@test.local',
        'password': 'WrongPassword!',
    })
    assert res.status_code == 401
    json_data = res.get_json()
    assert json_data['success'] is False


def test_register_user_success(client):
    res = client.post('/api/v1/auth/register', json={
        'name': 'New Officer',
        'email': 'officer@test.local',
        'password': 'StrongPassword@123',
    })
    assert res.status_code == 201
    json_data = res.get_json()
    assert json_data['success'] is True


def test_register_duplicate_email(client):
    res = client.post('/api/v1/auth/register', json={
        'name': 'Duplicate',
        'email': 'admin@test.local',
        'password': 'Password@123',
    })
    assert res.status_code in (409, 422)
    assert res.get_json()['success'] is False


def test_auth_me_endpoint(client, analyst_headers):
    res = client.get('/api/v1/auth/me', headers=analyst_headers)
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['data']['user']['email'] == 'analyst@test.local'
    assert json_data['data']['user']['role'] == 'Analyst'


def test_rbac_analyst_cannot_access_admin_route(client, analyst_headers):
    """Analyst must be denied access to admin-only settings endpoint."""
    res = client.get('/api/v1/admin/settings', headers=analyst_headers)
    assert res.status_code == 403
    json_data = res.get_json()
    assert json_data['success'] is False
    assert json_data['error']['code'] == 'FORBIDDEN'


def test_rbac_admin_can_access_admin_route(client, admin_headers):
    """Admin must be permitted access to admin settings."""
    res = client.get('/api/v1/admin/settings', headers=admin_headers)
    assert res.status_code == 200
    assert res.get_json()['success'] is True
