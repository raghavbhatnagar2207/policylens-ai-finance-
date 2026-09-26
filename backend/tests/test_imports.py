"""CSV import pipeline, validation, and confirmation tests."""

import io

def test_import_upload_and_confirm(client, analyst_headers):
    csv_content = (
        "record_id,region,department,category,allocation,utilization,delay_days,transaction_count,historical_average,date\n"
        "IMP-001,Lucknow,Public Works,Roads,1200.0,400.0,15,30,800.0,2025-08-10\n"
        "IMP-002,Kanpur,Health,Hospitals,950.0,900.0,5,80,920.0,2025-08-12\n"
    )
    data = {
        'file': (io.BytesIO(csv_content.encode('utf-8')), 'test_records.csv')
    }

    # 1. Upload
    upload_res = client.post(
        '/api/v1/imports/upload',
        headers=analyst_headers,
        data=data,
        content_type='multipart/form-data',
    )
    assert upload_res.status_code == 200
    res_data = upload_res.get_json()['data']
    assert res_data['total_rows'] == 2
    assert res_data['valid_rows'] == 2
    assert res_data['error_rows'] == 0
    import_id = res_data['import_id']

    # 2. Confirm
    confirm_res = client.post(f'/api/v1/imports/{import_id}/confirm', headers=analyst_headers)
    assert confirm_res.status_code == 200
    assert confirm_res.get_json()['data']['imported_count'] == 2


def test_import_upload_validation_errors(client, analyst_headers):
    # CSV with invalid numeric values and negative delay
    csv_content = (
        "record_id,region,department,category,allocation,utilization,delay_days,transaction_count,historical_average,date\n"
        "ERR-001,Agra,Public Works,Roads,-500.0,400.0,15,30,800.0,2025-08-10\n"
        "ERR-002,Varanasi,Health,Hospitals,950.0,900.0,-10,80,920.0,invalid-date\n"
    )
    data = {
        'file': (io.BytesIO(csv_content.encode('utf-8')), 'invalid_records.csv')
    }

    upload_res = client.post(
        '/api/v1/imports/upload',
        headers=analyst_headers,
        data=data,
        content_type='multipart/form-data',
    )
    assert upload_res.status_code == 200
    res_data = upload_res.get_json()['data']
    assert res_data['error_rows'] == 2
    assert len(res_data['errors']) == 2
    # Verify errors are structured correctly
    assert 'row' in res_data['errors'][0]
    assert 'errors' in res_data['errors'][0]
    assert len(res_data['errors'][0]['errors']) > 0


def test_import_upload_non_csv(client, analyst_headers):
    data = {
        'file': (io.BytesIO(b'some text content'), 'not_a_csv.txt')
    }
    res = client.post(
        '/api/v1/imports/upload',
        headers=analyst_headers,
        data=data,
        content_type='multipart/form-data',
    )
    assert res.status_code == 400
