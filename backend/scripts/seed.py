"""Seed script — populate the database with demo data.

Usage:
    cd backend
    python -m scripts.seed

Creates demo users, financial records across regions, and runs initial analysis.
"""

import sys
import os
from pathlib import Path
from datetime import date, datetime, timezone

# Ensure backend is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / '.env')

from app import create_app
from app.extensions import db
from app.models import User, FinancialRecord, SystemSetting

from werkzeug.security import generate_password_hash


def seed():
    app = create_app()

    with app.app_context():
        # Ensure database tables exist
        try:
            from flask_migrate import upgrade
            upgrade()
        except Exception:
            db.create_all()

        if User.query.first():
            print('Database already seeded. Skipping.')
            return

        print('Seeding database...')

        # ---------------------------------------------------------------
        # Users
        # ---------------------------------------------------------------
        users = [
            User(name='Admin User', email='admin@policylens.demo',
                 password_hash=generate_password_hash('Admin@1234'),
                 role='Admin', language='en'),
            User(name='Anshi Verma', email='anshi@policylens.demo',
                 password_hash=generate_password_hash('Manager@1234'),
                 role='Manager', language='en'),
            User(name='Rajesh Kumar', email='rajesh@policylens.demo',
                 password_hash=generate_password_hash('Analyst@1234'),
                 role='Analyst', language='hi'),
            User(name='Priya Singh', email='priya@policylens.demo',
                 password_hash=generate_password_hash('Reviewer@1234'),
                 role='Reviewer', language='en'),
            User(name='Vikram Mehta', email='vikram@policylens.demo',
                 password_hash=generate_password_hash('Auditor@1234'),
                 role='Auditor', language='en'),
        ]
        db.session.add_all(users)
        db.session.flush()
        print(f'  Created {len(users)} users')

        # ---------------------------------------------------------------
        # Financial Records — realistic demo data across Western UP regions
        # ---------------------------------------------------------------
        records_data = [
            # record_id, region, dept, category, alloc, util, delay, txn, hist_avg, fy, qtr, date
            ('PL-1001', 'Moradabad', 'Public Works', 'Infrastructure', 860, 298, 31, 45, 620, '2025-26', 'Q2', '2025-08-15'),
            ('PL-1002', 'Moradabad', 'Education', 'School Development', 420, 385, 8, 28, 390, '2025-26', 'Q2', '2025-09-01'),
            ('PL-1003', 'Rampur', 'Health', 'Medical Supplies', 720, 510, 18, 62, 530, '2025-26', 'Q2', '2025-08-20'),
            ('PL-1004', 'Rampur', 'Agriculture', 'Crop Insurance', 310, 290, 5, 120, 280, '2025-26', 'Q2', '2025-07-10'),
            ('PL-1005', 'Sambhal', 'Public Works', 'Road Construction', 540, 486, 5, 34, 510, '2025-26', 'Q2', '2025-08-25'),
            ('PL-1006', 'Sambhal', 'Water Supply', 'Sanitation', 380, 195, 22, 18, 340, '2025-26', 'Q2', '2025-09-05'),
            ('PL-1007', 'Amroha', 'Education', 'Scholarship', 920, 879, 8, 210, 860, '2025-26', 'Q2', '2025-07-20'),
            ('PL-1008', 'Amroha', 'Health', 'PHC Operations', 450, 420, 3, 55, 410, '2025-26', 'Q2', '2025-08-12'),
            ('PL-1009', 'Bijnor', 'Public Works', 'Bridge Repair', 670, 236, 27, 15, 580, '2025-26', 'Q2', '2025-09-10'),
            ('PL-1010', 'Bijnor', 'Agriculture', 'Irrigation', 520, 480, 10, 78, 495, '2025-26', 'Q2', '2025-08-01'),
            ('PL-1011', 'Meerut', 'Health', 'Hospital Upgrade', 780, 591, 12, 42, 720, '2025-26', 'Q2', '2025-07-15'),
            ('PL-1012', 'Meerut', 'Education', 'Teacher Training', 290, 275, 4, 95, 260, '2025-26', 'Q2', '2025-08-28'),
            ('PL-1013', 'Bareilly', 'Public Works', 'Drainage', 610, 145, 35, 12, 520, '2025-26', 'Q2', '2025-09-15'),
            ('PL-1014', 'Bareilly', 'Water Supply', 'Pipeline', 830, 790, 6, 30, 780, '2025-26', 'Q2', '2025-07-25'),
            ('PL-1015', 'Lucknow', 'Health', 'Vaccination Drive', 1200, 1150, 2, 340, 1100, '2025-26', 'Q2', '2025-08-05'),
            ('PL-1016', 'Lucknow', 'Education', 'University Grant', 950, 480, 25, 8, 880, '2025-26', 'Q2', '2025-09-20'),
            ('PL-1017', 'Agra', 'Public Works', 'Heritage Maintenance', 560, 530, 7, 22, 540, '2025-26', 'Q2', '2025-08-18'),
            ('PL-1018', 'Agra', 'Agriculture', 'Seed Distribution', 340, 88, 40, 200, 290, '2025-26', 'Q2', '2025-07-05'),
            ('PL-1019', 'Varanasi', 'Health', 'Emergency Services', 890, 850, 3, 150, 830, '2025-26', 'Q2', '2025-08-30'),
            ('PL-1020', 'Varanasi', 'Education', 'Skill Development', 470, 310, 15, 65, 420, '2025-26', 'Q2', '2025-09-12'),
            ('PL-1021', 'Moradabad', 'Water Supply', 'Borewell Project', 380, 105, 45, 7, 350, '2025-26', 'Q1', '2025-06-10'),
            ('PL-1022', 'Rampur', 'Public Works', 'Community Hall', 250, 240, 6, 18, 230, '2025-26', 'Q1', '2025-05-15'),
            ('PL-1023', 'Bijnor', 'Health', 'Rural Clinic', 180, 170, 4, 90, 165, '2025-26', 'Q1', '2025-06-20'),
            ('PL-1024', 'Meerut', 'Agriculture', 'Cold Storage', 1100, 320, 28, 5, 900, '2025-26', 'Q1', '2025-04-01'),
            ('PL-1025', 'Bareilly', 'Education', 'Library Fund', 150, 148, 2, 40, 140, '2025-26', 'Q1', '2025-05-25'),
        ]

        records = []
        for row in records_data:
            rid, region, dept, cat, alloc, util, delay, txn, hist, fy, qtr, dt = row
            rate = round(util / alloc * 100, 2) if alloc > 0 else 0
            r = FinancialRecord(
                record_id=rid,
                region=region,
                department=dept,
                category=cat,
                allocation=alloc,
                utilization=util,
                utilization_rate=rate,
                delay_days=delay,
                transaction_count=txn,
                historical_average=hist,
                fiscal_year=fy,
                quarter=qtr,
                date=date.fromisoformat(dt),
                data_source='Demo Seed',
                status='Active',
            )
            records.append(r)

        db.session.add_all(records)
        db.session.flush()
        print(f'  Created {len(records)} financial records')

        # ---------------------------------------------------------------
        # System Settings
        # ---------------------------------------------------------------
        defaults = [
            ('anomaly_contamination', '0.10', 'ml'),
            ('risk_threshold_high', '0.40', 'risk'),
            ('risk_threshold_critical', '0.60', 'risk'),
            ('delay_threshold_days', '20', 'risk'),
            ('utilization_low_threshold', '40', 'risk'),
            ('pagination_default', '25', 'system'),
            ('upload_max_size_mb', '16', 'system'),
        ]
        for key, val, cat in defaults:
            db.session.add(SystemSetting(key=key, value=val, category=cat))

        db.session.commit()
        print('  Created system settings')

        # ---------------------------------------------------------------
        # Run initial anomaly analysis
        # ---------------------------------------------------------------
        print('  Running initial anomaly analysis...')
        try:
            from app.ml.anomaly_detector import run_analysis
            results = run_analysis(records, user_id=users[0].id)
            db.session.commit()
            anomalies = sum(1 for r in results if r.get('is_anomaly'))
            print(f'  Analysis complete: {anomalies} anomalies detected in {len(results)} records')
        except Exception as e:
            print(f'  Analysis skipped: {e}')
            db.session.rollback()

        print('Seed completed successfully.')
        print()
        print('Demo credentials:')
        print('  Admin:    admin@policylens.demo    / Admin@1234')
        print('  Manager:  anshi@policylens.demo    / Manager@1234')
        print('  Analyst:  rajesh@policylens.demo   / Analyst@1234')
        print('  Reviewer: priya@policylens.demo    / Reviewer@1234')
        print('  Auditor:  vikram@policylens.demo   / Auditor@1234')


if __name__ == '__main__':
    seed()
