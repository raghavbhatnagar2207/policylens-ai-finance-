"""CSV file import routes with bulk validation, duplicate prevention, and JSON error storage."""

import csv
import io
import os
import math
import json
import uuid
from datetime import datetime, timezone, date
from flask import Blueprint, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.extensions import db, limiter
from app.models import FinancialRecord, Import
from app.utils import success_response, error_response, paginate_query
from app.auth import require_role
from app.services import log_action

imports_bp = Blueprint('imports', __name__)

REQUIRED_COLUMNS = {'record_id', 'region', 'allocation', 'utilization'}
ALLOWED_EXTENSIONS = {'csv'}
MAX_IMPORT_ROWS = 5000


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _parse_date(val):
    if not val:
        return None
    val = str(val).strip()
    for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y', '%d/%m/%Y'):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


@imports_bp.post('/upload')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst')
@limiter.limit("10 per minute")
def upload():
    """Upload and validate a CSV file, returning a preview and error diagnostics."""
    if 'file' not in request.files:
        return error_response('VALIDATION_ERROR', 'No file provided.', 400)

    file = request.files['file']
    if not file.filename or not _allowed_file(file.filename):
        return error_response('VALIDATION_ERROR', 'Only CSV files are supported.', 400)

    uid = int(get_jwt_identity())

    # Read and decode
    try:
        content = file.read().decode('utf-8-sig')
    except UnicodeDecodeError:
        return error_response('VALIDATION_ERROR', 'File must be UTF-8 encoded.', 400)

    reader = list(csv.DictReader(io.StringIO(content)))
    if not reader:
        return error_response('VALIDATION_ERROR', 'CSV file appears to be empty or has no header.', 400)

    if len(reader) > MAX_IMPORT_ROWS:
        return error_response('PAYLOAD_TOO_LARGE', f'File exceeds maximum row limit of {MAX_IMPORT_ROWS} rows.', 413)

    fieldnames = set(reader[0].keys())
    missing = REQUIRED_COLUMNS - fieldnames
    if missing:
        return error_response('VALIDATION_ERROR',
                              f'Missing required columns: {", ".join(sorted(missing))}', 400)

    rows = []
    errors = []
    seen_in_batch = set()

    for i, row in enumerate(reader, start=2):
        row_errors = []
        rid = (row.get('record_id') or '').strip()
        region = (row.get('region') or '').strip()

        if not rid:
            row_errors.append('record_id is required')
        elif rid in seen_in_batch:
            row_errors.append(f'duplicate record_id "{rid}" within file')
        seen_in_batch.add(rid)

        if not region:
            row_errors.append('region is required')

        # Allocation
        alloc_val = row.get('allocation', '')
        try:
            alloc = float(alloc_val)
            if not math.isfinite(alloc) or alloc < 0:
                row_errors.append('allocation must be a non-negative finite number')
        except (ValueError, TypeError):
            row_errors.append('allocation must be numeric')
            alloc = 0.0

        # Utilization
        util_val = row.get('utilization', '')
        try:
            util = float(util_val)
            if not math.isfinite(util) or util < 0:
                row_errors.append('utilization must be a non-negative finite number')
        except (ValueError, TypeError):
            row_errors.append('utilization must be numeric')
            util = 0.0

        # Delay days (valid 0 must not be rejected)
        delay_val = row.get('delay_days')
        if delay_val not in (None, ''):
            try:
                delay = int(delay_val)
                if delay < 0 or delay > 3650:
                    row_errors.append('delay_days must be between 0 and 3650')
            except (ValueError, TypeError):
                row_errors.append('delay_days must be an integer')

        # Date validation if present
        date_val = row.get('date')
        if date_val and not _parse_date(date_val):
            row_errors.append('date must be a valid date format (e.g. YYYY-MM-DD)')

        if row_errors:
            errors.append({'row': i, 'record_id': rid, 'errors': row_errors})

        rows.append(row)

    # Save import record
    safe_name = f"{uuid.uuid4().hex}.csv"
    imp = Import(
        filename=safe_name,
        original_filename=secure_filename(file.filename),
        status='Validated',
        total_rows=len(rows),
        valid_rows=len(rows) - len(errors),
        error_rows=len(errors),
        errors=json.dumps(errors) if errors else None,  # Proper JSON encoding!
        created_by=uid,
    )
    db.session.add(imp)
    db.session.flush()

    upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    os.makedirs(upload_dir, exist_ok=True)
    with open(os.path.join(upload_dir, safe_name), 'w', encoding='utf-8') as f:
        f.write(content)

    db.session.commit()

    return success_response(data={
        'import_id': imp.id,
        'total_rows': len(rows),
        'valid_rows': len(rows) - len(errors),
        'error_rows': len(errors),
        'errors': errors[:20],
        'columns': list(fieldnames),
        'preview': rows[:5],
    }, message='File validated. Use POST /imports/{id}/confirm to import.')


@imports_bp.post('/<int:import_id>/confirm')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst')
def confirm(import_id):
    """Confirm and process a validated import, preventing duplicates without N+1 queries."""
    imp = db.session.get(Import, import_id)
    if not imp:
        return error_response('NOT_FOUND', 'Import not found.', 404)
    if imp.status != 'Validated':
        return error_response('INVALID_STATE', 'Import has already been processed or is in invalid state.', 400)

    upload_dir = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    filepath = os.path.join(upload_dir, imp.filename)

    if not os.path.exists(filepath):
        return error_response('NOT_FOUND', 'Import file not found on server.', 404)

    with open(filepath, 'r', encoding='utf-8') as f:
        rows = list(csv.DictReader(f))

    # Bulk query existing record_ids to prevent N+1 database queries
    all_rids = [r.get('record_id', '').strip() for r in rows if r.get('record_id', '').strip()]
    existing_rids = set()
    if all_rids:
        found = db.session.query(FinancialRecord.record_id).filter(
            FinancialRecord.record_id.in_(all_rids)
        ).all()
        existing_rids = {f[0] for f in found}

    imported = 0
    skipped = 0
    inserted_in_run = set()

    for row in rows:
        rid = row.get('record_id', '').strip()
        if not rid or rid in existing_rids or rid in inserted_in_run:
            skipped += 1
            continue

        try:
            alloc = float(row.get('allocation', 0))
            util = float(row.get('utilization', 0))
        except (ValueError, TypeError):
            skipped += 1
            continue

        rate = round(util / alloc * 100, 2) if alloc > 0 else 0.0

        # Delay days: check for explicit '0'
        delay_val = row.get('delay_days')
        delay = int(delay_val) if delay_val not in (None, '') and str(delay_val).isdigit() else 0

        # Transaction count
        tx_val = row.get('transaction_count')
        tx_count = int(tx_val) if tx_val not in (None, '') and str(tx_val).isdigit() else 0

        # Historical average
        hist_val = row.get('historical_average')
        hist_avg = float(hist_val) if hist_val not in (None, '') else None

        record = FinancialRecord(
            record_id=rid,
            region=row.get('region', '').strip(),
            department=row.get('department', '').strip() or None,
            category=row.get('category', '').strip() or None,
            allocation=alloc,
            utilization=util,
            utilization_rate=float(row.get('utilization_rate', rate)),
            delay_days=delay,
            transaction_count=tx_count,
            historical_average=hist_avg,
            fiscal_year=row.get('fiscal_year', '').strip() or None,
            quarter=row.get('quarter', '').strip() or None,
            date=_parse_date(row.get('date')),
            data_source='CSV Import',
            import_id=imp.id,
        )
        db.session.add(record)
        inserted_in_run.add(rid)
        imported += 1

    imp.status = 'Completed'
    imp.valid_rows = imported
    imp.completed_at = datetime.now(timezone.utc)

    log_action('IMPORT_COMPLETED', 'Import', imp.id,
               {'imported': imported, 'skipped': skipped})
    db.session.commit()

    data_out = imp.to_dict()
    data_out['imported_count'] = imported
    data_out['skipped_count'] = skipped

    return success_response(data=data_out,
                            message=f'Imported {imported} records. {skipped} skipped (duplicates or invalid).')


@imports_bp.get('/')
@jwt_required()
@require_role('Admin', 'Manager')
def list_imports():
    query = Import.query.order_by(Import.created_at.desc())
    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)
