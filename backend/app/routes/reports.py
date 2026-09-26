"""Report generation routes — CSV and PDF export with persistent storage and BOLA checks."""

import csv
import io
import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db, limiter
from app.models import (
    Report, FinancialRecord, AnomalyResult, RiskCase, Complaint, Notification,
)
from app.utils import success_response, error_response, paginate_query
from app.auth import (
    require_active_user, require_role, get_current_user,
    can_view_report, can_download_report,
)
from app.services import log_action

reports_bp = Blueprint('reports', __name__)

REPORT_TYPES = ('financial_summary', 'anomaly_report', 'risk_report', 'case_report', 'complaint_report')


def _generate_pdf(report, data_rows, file_path):
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Image as RLImage
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    doc = SimpleDocTemplate(file_path, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []

    # Official PolicyLens Brand Logo at the top of the report
    logo_path = os.path.join(current_app.root_path, 'static', 'policylens-logo.png')
    if os.path.exists(logo_path):
        story.append(RLImage(logo_path, width=175, height=46))
        story.append(Spacer(1, 6))

    subtitle_style = ParagraphStyle(
        'ReportSubtitle', parent=styles['Normal'], fontSize=8.5, textColor=colors.HexColor('#69737A'), spaceAfter=10
    )
    story.append(Paragraph("Financial Risk Intelligence Platform", subtitle_style))

    title_style = ParagraphStyle(
        'ReportTitle', parent=styles['Heading1'], fontSize=15, textColor=colors.HexColor('#20282D'), spaceAfter=4
    )
    story.append(Paragraph(report.title, title_style))

    meta_style = ParagraphStyle(
        'ReportMeta', parent=styles['Normal'], fontSize=8, textColor=colors.HexColor('#69737A'), spaceAfter=14
    )
    story.append(Paragraph(
        f"Report ID: {report.report_id} | Type: {report.report_type.replace('_', ' ').title()} | Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}",
        meta_style
    ))

    if data_rows:
        all_keys = list(data_rows[0].keys())
        display_keys = all_keys[:6]
        header_cells = [Paragraph(f"<b>{k.replace('_', ' ').title()}</b>", styles['Normal']) for k in display_keys]
        table_data = [header_cells]

        for r in data_rows[:150]:
            row = [Paragraph(str(r.get(k, '') if r.get(k) is not None else ''), styles['Normal']) for k in display_keys]
            table_data.append(row)

        t = Table(table_data, repeatRows=1)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
        ]))
        story.append(t)
    else:
        story.append(Paragraph("No records found for this report criteria.", styles['Normal']))

    doc.build(story)


def _generate_csv(report, data_rows, file_path):
    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        if data_rows:
            writer = csv.DictWriter(f, fieldnames=data_rows[0].keys())
            writer.writeheader()
            for r in data_rows:
                writer.writerow({k: str(v) if v is not None else '' for k, v in r.items()})
        else:
            f.write("No records found\n")


def _execute_report_generation(d, uid):
    report_type = d.get('type', 'financial_summary')
    fmt = (d.get('format', 'csv') or 'csv').lower()

    if report_type not in REPORT_TYPES:
        return error_response('VALIDATION_ERROR',
                              f'Invalid report type. Valid: {", ".join(REPORT_TYPES)}', 400)
    if fmt not in ('csv', 'pdf', 'json'):
        return error_response('VALIDATION_ERROR', 'Format must be csv, pdf, or json.', 400)

    report_id = f"RPT-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    # Fetch data rows
    if report_type == 'financial_summary':
        records = FinancialRecord.query.order_by(FinancialRecord.record_id).all()
        data_rows = [r.to_dict() for r in records]
        title = 'Financial Summary Report'
    elif report_type == 'anomaly_report':
        from sqlalchemy import func
        subq = db.session.query(
            AnomalyResult.financial_record_id,
            func.max(AnomalyResult.id).label('max_id'),
        ).group_by(AnomalyResult.financial_record_id).subquery()
        results = AnomalyResult.query.join(
            subq, AnomalyResult.id == subq.c.max_id
        ).order_by(AnomalyResult.risk_score.desc()).all()
        data_rows = [r.to_dict() for r in results]
        title = 'Anomaly Analysis Report'
    elif report_type in ('risk_report', 'case_report'):
        cases = RiskCase.query.order_by(RiskCase.created_at.desc()).all()
        data_rows = [c.to_dict() for c in cases]
        title = 'Risk Cases Report'
    elif report_type == 'complaint_report':
        complaints = Complaint.query.order_by(Complaint.created_at.desc()).all()
        data_rows = [c.to_dict() for c in complaints]
        title = 'Complaint Report'
    else:
        data_rows = []
        title = 'Report'

    # Save to disk
    report_folder = current_app.config.get('REPORT_FOLDER', 'reports')
    os.makedirs(report_folder, exist_ok=True)
    filename = f"{report_id}.{fmt}"
    file_path = os.path.join(report_folder, filename)

    try:
        if fmt == 'pdf':
            _generate_pdf(type('R', (), {'title': title, 'report_id': report_id, 'report_type': report_type})(), data_rows, file_path)
        elif fmt == 'csv':
            _generate_csv(type('R', (), {'title': title, 'report_id': report_id, 'report_type': report_type})(), data_rows, file_path)
    except Exception as e:
        current_app.logger.error(f'Failed to generate report file: {e}')
        return error_response('REPORT_GENERATION_FAILED', 'Failed to generate report file.', 500)

    # Save metadata
    report = Report(
        report_id=report_id,
        report_type=report_type,
        title=title,
        format=fmt,
        file_path=filename,  # relative filename
        status='Completed',
        created_by=uid,
    )
    db.session.add(report)
    db.session.flush()

    # Generate ready notification
    notif = Notification(
        user_id=uid,
        title=f'Report Ready: {report.title}',
        message=f'Your {report.format.upper()} report ({report.report_id}) has been generated and is ready for download.',
        type='success',
        resource_type='Report',
        resource_id=report.report_id,
    )
    db.session.add(notif)
    log_action('REPORT_GENERATED', 'Report', report_id, {'type': report_type, 'format': fmt})
    db.session.commit()

    return success_response(data={
        'report': report.to_dict(),
        'download_url': f"/api/v1/reports/{report.id}/download",
        'rows_count': len(data_rows),
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }, status=201, message='Report generated successfully.')


@reports_bp.post('/')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst')
@limiter.limit("10 per minute")
def create_report():
    d = request.get_json(silent=True) or {}
    uid = int(get_jwt_identity())
    return _execute_report_generation(d, uid)


@reports_bp.post('/generate')
@jwt_required()
@require_role('Admin', 'Manager', 'Analyst')
@limiter.limit("10 per minute")
def generate_report_alias():
    d = request.get_json(silent=True) or {}
    uid = int(get_jwt_identity())
    return _execute_report_generation(d, uid)


@reports_bp.get('/')
@jwt_required()
@require_active_user()
def list_reports():
    user = get_current_user()
    query = Report.query

    if user.role not in ('Admin', 'Manager', 'Auditor'):
        query = query.filter(Report.created_by == user.id)

    query = query.order_by(Report.created_at.desc())
    items, meta = paginate_query(query)
    return success_response(data=items, meta=meta)


@reports_bp.get('/<int:report_id>')
@jwt_required()
@require_active_user()
def get_report(report_id):
    user = get_current_user()
    report = db.session.get(Report, report_id)
    if not report:
        return error_response('NOT_FOUND', 'Report not found.', 404)

    if not can_view_report(user, report):
        return error_response('FORBIDDEN', 'You do not have permission to view this report.', 403)

    return success_response(data=report.to_dict())


@reports_bp.get('/<int:report_id>/download')
@jwt_required()
@require_active_user()
def download_report(report_id):
    user = get_current_user()
    report = db.session.get(Report, report_id)
    if not report:
        return error_response('NOT_FOUND', 'Report not found.', 404)

    if not can_download_report(user, report):
        return error_response('FORBIDDEN', 'You do not have permission to download this report.', 403)

    report_folder = current_app.config.get('REPORT_FOLDER', 'reports')
    filename = report.file_path or f"{report.report_id}.{report.format}"
    full_path = os.path.join(report_folder, filename)

    if not os.path.exists(full_path):
        return error_response('NOT_FOUND', 'Report file not found on server.', 404)

    mime_types = {
        'csv': 'text/csv',
        'pdf': 'application/pdf',
        'json': 'application/json',
    }
    mimetype = mime_types.get(report.format, 'application/octet-stream')

    log_action('REPORT_DOWNLOADED', 'Report', report.report_id)
    db.session.commit()

    return send_file(
        full_path,
        mimetype=mimetype,
        as_attachment=True,
        download_name=f"{report.report_id}.{report.format}",
    )
