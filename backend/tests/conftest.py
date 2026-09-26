"""Pytest fixtures for PolicyLens AI backend."""

import os
import sys
import pytest
from pathlib import Path
from datetime import date

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import create_app
from app.extensions import db
from app.models import User, FinancialRecord, SystemSetting
from werkzeug.security import generate_password_hash


@pytest.fixture(scope='function')
def app():
    """Create application configured for testing."""
    os.environ['FLASK_ENV'] = 'testing'
    app_instance = create_app('testing')
    with app_instance.app_context():
        db.create_all()

        # Seed test users
        admin = User(
            name='Test Admin',
            email='admin@test.local',
            password_hash=generate_password_hash('AdminPass@123'),
            role='Admin',
            is_active=True,
        )
        analyst = User(
            name='Test Analyst',
            email='analyst@test.local',
            password_hash=generate_password_hash('AnalystPass@123'),
            role='Analyst',
            is_active=True,
        )
        reviewer = User(
            name='Test Reviewer',
            email='reviewer@test.local',
            password_hash=generate_password_hash('ReviewerPass@123'),
            role='Reviewer',
            is_active=True,
        )
        db.session.add_all([admin, analyst, reviewer])

        # Seed sample financial records
        records = [
            FinancialRecord(
                record_id='TEST-001',
                region='Moradabad',
                department='Public Works',
                category='Infrastructure',
                allocation=860.0,
                utilization=298.0,
                utilization_rate=34.65,
                delay_days=31,
                transaction_count=45,
                historical_average=620.0,
                date=date(2025, 8, 15),
                status='Active',
            ),
            FinancialRecord(
                record_id='TEST-002',
                region='Rampur',
                department='Health',
                category='Medical Supplies',
                allocation=720.0,
                utilization=510.0,
                utilization_rate=70.83,
                delay_days=18,
                transaction_count=62,
                historical_average=530.0,
                date=date(2025, 8, 20),
                status='Active',
            ),
            FinancialRecord(
                record_id='TEST-003',
                region='Sambhal',
                department='Education',
                category='Schools',
                allocation=540.0,
                utilization=486.0,
                utilization_rate=90.0,
                delay_days=5,
                transaction_count=34,
                historical_average=510.0,
                date=date(2025, 8, 25),
                status='Active',
            ),
            FinancialRecord(
                record_id='TEST-004',
                region='Amroha',
                department='Agriculture',
                category='Irrigation',
                allocation=920.0,
                utilization=879.0,
                utilization_rate=95.54,
                delay_days=8,
                transaction_count=210,
                historical_average=860.0,
                date=date(2025, 7, 20),
                status='Active',
            ),
        ]
        db.session.add_all(records)

        # Seed settings
        db.session.add(SystemSetting(key='anomaly_contamination', value='0.10', category='ml'))
        db.session.add(SystemSetting(key='risk_threshold_high', value='0.40', category='risk'))

        db.session.commit()

        yield app_instance

        db.session.remove()
        db.drop_all()


@pytest.fixture(scope='function')
def client(app):
    """Test client."""
    return app.test_client()


@pytest.fixture
def admin_headers(client):
    """Auth header for Admin user."""
    res = client.post('/api/v1/auth/login', json={
        'email': 'admin@test.local',
        'password': 'AdminPass@123',
    })
    token = res.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def analyst_headers(client):
    """Auth header for Analyst user."""
    res = client.post('/api/v1/auth/login', json={
        'email': 'analyst@test.local',
        'password': 'AnalystPass@123',
    })
    token = res.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def reviewer_headers(client):
    """Auth header for Reviewer user."""
    res = client.post('/api/v1/auth/login', json={
        'email': 'reviewer@test.local',
        'password': 'ReviewerPass@123',
    })
    token = res.get_json()['data']['access_token']
    return {'Authorization': f'Bearer {token}'}
