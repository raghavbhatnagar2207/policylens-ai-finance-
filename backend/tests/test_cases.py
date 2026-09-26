"""Case management, state machine transitions, and BOLA authorization tests."""

from app.models import FinancialRecord, RiskCase


def test_create_and_transition_case(client, analyst_headers, admin_headers):
    # Get a record
    rec = FinancialRecord.query.first()

    # 1. Create case
    res = client.post('/api/v1/cases/', headers=analyst_headers, json={
        'record_id': rec.id,
        'title': 'Test Moradabad Case',
        'priority': 'Critical',
        'description': 'Suspected delay backlog.',
    })
    assert res.status_code == 201
    case_data = res.get_json()['data']
    case_id = case_data['id']
    assert case_data['status'] == 'New'
    assert case_data['priority'] == 'Critical'
    assert case_data['case_number'].startswith('RC-')

    # 2. Add an investigation note
    note_res = client.post(f'/api/v1/cases/{case_id}/events', headers=analyst_headers, json={
        'action': 'NOTE_ADDED',
        'comment': 'Contacted regional engineering office for invoice documentation.',
    })
    assert note_res.status_code == 200

    # 3. Transition status from New to Under Review (valid transition)
    patch_res = client.patch(f'/api/v1/cases/{case_id}', headers=analyst_headers, json={
        'status': 'Under Review',
    })
    assert patch_res.status_code == 200
    assert patch_res.get_json()['data']['status'] == 'Under Review'

    # 4. Analyst attempting to modify Under Review case receives 403 Forbidden (BOLA protection)
    analyst_modify_forbidden = client.patch(f'/api/v1/cases/{case_id}', headers=analyst_headers, json={
        'status': 'Resolved',
    })
    assert analyst_modify_forbidden.status_code == 403

    # 5. Admin attempts to resolve without resolution text (rejected with 400 VALIDATION_ERROR)
    resolve_fail = client.patch(f'/api/v1/cases/{case_id}', headers=admin_headers, json={
        'status': 'Resolved',
    })
    assert resolve_fail.status_code == 400
    assert 'resolution' in resolve_fail.get_json()['error']['message'].lower()

    # 6. Admin resolves with required resolution explanation
    resolve_ok = client.patch(f'/api/v1/cases/{case_id}', headers=admin_headers, json={
        'status': 'Resolved',
        'resolution': 'Audit confirmed invoice discrepancy resolved with regional contractor.',
    })
    assert resolve_ok.status_code == 200
    assert resolve_ok.get_json()['data']['status'] == 'Resolved'

    # 7. Verify case history and events
    get_res = client.get(f'/api/v1/cases/{case_id}', headers=analyst_headers)
    assert get_res.status_code == 200
    events = get_res.get_json()['data']['events']
    assert len(events) >= 3  # creation + note + status changes


def test_invalid_case_transition_as_analyst(client, analyst_headers):
    rec = FinancialRecord.query.first()
    res = client.post('/api/v1/cases/', headers=analyst_headers, json={
        'record_id': rec.id,
        'title': 'Jump Test Case',
    })
    case_id = res.get_json()['data']['id']

    # New cannot transition directly to Closed
    res_jump = client.patch(f'/api/v1/cases/{case_id}', headers=analyst_headers, json={
        'status': 'Closed',
        'resolution': 'Premature closure',
    })
    assert res_jump.status_code == 400
    assert res_jump.get_json()['error']['code'] == 'INVALID_STATE_TRANSITION'
