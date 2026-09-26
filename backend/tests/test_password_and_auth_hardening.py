"""Authentication hardening, password change, refresh, and blocklist tests."""

def test_change_password_success(client, analyst_headers):
    # 1. Change password with correct current password
    res = client.patch('/api/v1/auth/change-password', headers=analyst_headers, json={
        'current_password': 'AnalystPass@123',
        'new_password': 'NewSecurePass@2026',
    })
    assert res.status_code == 200
    assert res.get_json()['success'] is True

    # 2. Login with old password must fail
    old_login = client.post('/api/v1/auth/login', json={
        'email': 'analyst@test.local',
        'password': 'AnalystPass@123',
    })
    assert old_login.status_code == 401

    # 3. Login with new password must succeed
    new_login = client.post('/api/v1/auth/login', json={
        'email': 'analyst@test.local',
        'password': 'NewSecurePass@2026',
    })
    assert new_login.status_code == 200
    assert 'access_token' in new_login.get_json()['data']


def test_change_password_wrong_current(client, analyst_headers):
    res = client.patch('/api/v1/auth/change-password', headers=analyst_headers, json={
        'current_password': 'IncorrectPassword!',
        'new_password': 'NewSecurePass@2026',
    })
    assert res.status_code == 401
    assert res.get_json()['success'] is False


def test_change_password_weak_new(client, analyst_headers):
    res = client.patch('/api/v1/auth/change-password', headers=analyst_headers, json={
        'current_password': 'AnalystPass@123',
        'new_password': 'short',
    })
    assert res.status_code == 422
    assert res.get_json()['success'] is False


def test_token_refresh_lifecycle(client):
    # Login to get refresh token
    login_res = client.post('/api/v1/auth/login', json={
        'email': 'admin@test.local',
        'password': 'AdminPass@123',
    })
    refresh_token = login_res.get_json()['data']['refresh_token']

    # Use refresh token to obtain fresh access token
    refresh_res = client.post('/api/v1/auth/refresh', headers={
        'Authorization': f'Bearer {refresh_token}',
    })
    assert refresh_res.status_code == 200
    assert 'access_token' in refresh_res.get_json()['data']


def test_logout_revokes_token(client):
    # Login
    login_res = client.post('/api/v1/auth/login', json={
        'email': 'admin@test.local',
        'password': 'AdminPass@123',
    })
    access_token = login_res.get_json()['data']['access_token']
    headers = {'Authorization': f'Bearer {access_token}'}

    # Verify access works
    check1 = client.get('/api/v1/auth/me', headers=headers)
    assert check1.status_code == 200

    # Logout
    logout_res = client.post('/api/v1/auth/logout', headers=headers)
    assert logout_res.status_code == 200

    # Verify token is now blocked
    check2 = client.get('/api/v1/auth/me', headers=headers)
    assert check2.status_code == 401
