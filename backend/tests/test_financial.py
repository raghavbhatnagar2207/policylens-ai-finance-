"""Financial records API tests."""

def test_list_records_paginated(client, analyst_headers):
    res = client.get('/api/v1/financial-records/?page=1&per_page=2', headers=analyst_headers)
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['success'] is True
    assert len(json_data['data']) == 2
    assert json_data['meta']['total_items'] >= 4


def test_search_records(client, analyst_headers):
    res = client.get('/api/v1/financial-records/?q=Moradabad', headers=analyst_headers)
    assert res.status_code == 200
    json_data = res.get_json()
    assert len(json_data['data']) >= 1
    assert json_data['data'][0]['region'] == 'Moradabad'


def test_filter_by_region(client, analyst_headers):
    res = client.get('/api/v1/financial-records/?region=Rampur', headers=analyst_headers)
    assert res.status_code == 200
    json_data = res.get_json()
    assert all(r['region'] == 'Rampur' for r in json_data['data'])


def test_get_single_record(client, analyst_headers):
    # Fetch first record
    list_res = client.get('/api/v1/financial-records/', headers=analyst_headers)
    first_id = list_res.get_json()['data'][0]['id']

    res = client.get(f'/api/v1/financial-records/{first_id}', headers=analyst_headers)
    assert res.status_code == 200
    json_data = res.get_json()
    assert json_data['data']['id'] == first_id
    assert 'allocation' in json_data['data']
    assert 'utilization' in json_data['data']


def test_export_csv(client, analyst_headers):
    res = client.get('/api/v1/financial-records/export', headers=analyst_headers)
    assert res.status_code == 200
    assert 'text/csv' in res.content_type
    content = res.data.decode('utf-8')
    assert 'record_id' in content
    assert 'region' in content
    assert 'allocation' in content
