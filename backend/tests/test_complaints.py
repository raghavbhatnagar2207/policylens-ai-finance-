"""Complaints and NLP classification tests."""

def test_submit_complaint_nlp_english(client, analyst_headers):
    res = client.post('/api/v1/complaints/', headers=analyst_headers, json={
        'text': 'The highway construction contractor stopped work 4 months ago despite full budget allocation.',
    })
    assert res.status_code == 201
    json_data = res.get_json()['data']
    assert json_data['reference_id'].startswith('PL-C')
    assert json_data['language'].lower() in ('en', 'english')
    assert json_data['status'] == 'Open'
    assert json_data['urgency'] in ('High', 'Medium', 'Low')


def test_submit_complaint_nlp_hinglish(client, analyst_headers):
    res = client.post('/api/v1/complaints/', headers=analyst_headers, json={
        'text': 'Hospital me medicines nahi mil rahi hain aur staff bolta hai budget khatam ho gaya.',
    })
    assert res.status_code == 201
    json_data = res.get_json()['data']
    assert json_data['reference_id'].startswith('PL-C')
    assert json_data['status'] == 'Open'


def test_update_complaint_status(client, admin_headers):
    # Create complaint
    create_res = client.post('/api/v1/complaints/', headers=admin_headers, json={
        'text': 'School building roof collapsed after recent rains due to substandard cement.',
    })
    cid = create_res.get_json()['data']['id']

    # Update status
    patch_res = client.patch(f'/api/v1/complaints/{cid}', headers=admin_headers, json={
        'status': 'Under Review',
    })
    assert patch_res.status_code == 200
    assert patch_res.get_json()['data']['status'] == 'Under Review'
