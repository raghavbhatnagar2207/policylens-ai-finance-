"""Report generation, download, and BOLA authorization tests."""

def test_generate_and_download_csv_report(client, analyst_headers):
    # 1. Generate CSV Report
    res = client.post('/api/v1/reports/', headers=analyst_headers, json={
        'type': 'financial_summary',
        'format': 'csv',
    })
    assert res.status_code == 201
    data = res.get_json()['data']
    assert data['report']['format'] == 'csv'
    assert data['report']['report_id'].startswith('RPT-')
    report_id = data['report']['id']

    # 2. Download CSV Report
    dl_res = client.get(f'/api/v1/reports/{report_id}/download', headers=analyst_headers)
    assert dl_res.status_code == 200
    assert 'text/csv' in dl_res.headers.get('Content-Type', '')
    assert len(dl_res.data) > 0


def test_generate_and_download_pdf_report(client, analyst_headers):
    # 1. Generate PDF Report
    res = client.post('/api/v1/reports/', headers=analyst_headers, json={
        'type': 'risk_report',
        'format': 'pdf',
    })
    assert res.status_code == 201
    data = res.get_json()['data']
    assert data['report']['format'] == 'pdf'
    report_id = data['report']['id']

    # 2. Download PDF Report
    dl_res = client.get(f'/api/v1/reports/{report_id}/download', headers=analyst_headers)
    assert dl_res.status_code == 200
    assert 'application/pdf' in dl_res.headers.get('Content-Type', '')
    assert dl_res.data.startswith(b'%PDF')


def test_list_reports(client, analyst_headers):
    res = client.get('/api/v1/reports/', headers=analyst_headers)
    assert res.status_code == 200
    assert isinstance(res.get_json()['data'], list)


def test_invalid_report_type(client, analyst_headers):
    res = client.post('/api/v1/reports/', headers=analyst_headers, json={
        'type': 'non_existent_type',
        'format': 'csv',
    })
    assert res.status_code == 400
    assert res.get_json()['error']['code'] == 'VALIDATION_ERROR'


def test_download_unauthorized(client):
    res = client.get('/api/v1/reports/1/download')
    assert res.status_code == 401
