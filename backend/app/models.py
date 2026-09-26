"""PolicyLens AI — Data Models.

All models in a single module for simplicity. Uses integer PKs internally
and human-readable reference IDs for external display.  Financial amounts
use db.Numeric for precision (mapped to DECIMAL in Postgres, NUMERIC in SQLite).
"""

from datetime import datetime, timezone
from app.extensions import db


def _utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(40), nullable=False, default='Analyst')
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    language = db.Column(db.String(12), default='en')
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    assigned_cases = db.relationship('RiskCase', foreign_keys='RiskCase.assigned_to', back_populates='assignee', lazy='dynamic')
    notifications = db.relationship('Notification', back_populates='user', lazy='dynamic')

    VALID_ROLES = ('Admin', 'Manager', 'Analyst', 'Reviewer', 'Auditor', 'User')

    def to_dict(self, include_email=False):
        d = {
            'id': self.id,
            'name': self.name,
            'role': self.role,
            'is_active': self.is_active,
            'language': self.language,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_email:
            d['email'] = self.email
        return d


# ---------------------------------------------------------------------------
# Financial Records
# ---------------------------------------------------------------------------

class FinancialRecord(db.Model):
    __tablename__ = 'financial_records'

    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(32), unique=True, nullable=False, index=True)
    region = db.Column(db.String(80), nullable=False, index=True)
    department = db.Column(db.String(100))
    category = db.Column(db.String(80))
    allocation = db.Column(db.Numeric(14, 2), nullable=False)
    utilization = db.Column(db.Numeric(14, 2), nullable=False)
    utilization_rate = db.Column(db.Numeric(6, 2))
    delay_days = db.Column(db.Integer, default=0)
    transaction_count = db.Column(db.Integer, default=0)
    historical_average = db.Column(db.Numeric(14, 2))
    fiscal_year = db.Column(db.String(10))
    quarter = db.Column(db.String(4))
    date = db.Column(db.Date)
    status = db.Column(db.String(30), default='Active')
    data_source = db.Column(db.String(80))
    import_id = db.Column(db.Integer, db.ForeignKey('imports.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)

    # Relationships
    anomaly_results = db.relationship('AnomalyResult', back_populates='financial_record', lazy='dynamic')
    cases = db.relationship('RiskCase', back_populates='financial_record', lazy='dynamic')

    def to_dict(self, include_latest_anomaly=False):
        d = {
            'id': self.id,
            'record_id': self.record_id,
            'region': self.region,
            'department': self.department,
            'category': self.category,
            'allocation': float(self.allocation) if self.allocation else 0,
            'utilization': float(self.utilization) if self.utilization else 0,
            'utilization_rate': float(self.utilization_rate) if self.utilization_rate else 0,
            'delay_days': self.delay_days,
            'transaction_count': self.transaction_count,
            'historical_average': float(self.historical_average) if self.historical_average else None,
            'fiscal_year': self.fiscal_year,
            'quarter': self.quarter,
            'date': self.date.isoformat() if self.date else None,
            'status': self.status,
            'data_source': self.data_source,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_latest_anomaly:
            latest = self.anomaly_results.order_by(AnomalyResult.created_at.desc()).first()
            if latest:
                d['latest_anomaly'] = latest.to_dict()
                d['anomaly'] = d['latest_anomaly']
            else:
                d['latest_anomaly'] = None
                d['anomaly'] = None
        return d


# ---------------------------------------------------------------------------
# Anomaly Results
# ---------------------------------------------------------------------------

class AnomalyResult(db.Model):
    __tablename__ = 'anomaly_results'

    id = db.Column(db.Integer, primary_key=True)
    financial_record_id = db.Column(db.Integer, db.ForeignKey('financial_records.id'), nullable=False, index=True)
    model_version = db.Column(db.String(40))
    anomaly_score = db.Column(db.Float)
    is_anomaly = db.Column(db.Boolean, default=False)
    risk_level = db.Column(db.String(12), index=True)
    risk_score = db.Column(db.Float)
    features = db.Column(db.Text)           # JSON: feature values used
    explanations = db.Column(db.Text)       # JSON: per-feature explanations
    model_run_id = db.Column(db.Integer, db.ForeignKey('model_runs.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    financial_record = db.relationship('FinancialRecord', back_populates='anomaly_results')
    model_run = db.relationship('ModelRun', back_populates='results')

    def to_dict(self):
        import json
        exps = json.loads(self.explanations) if self.explanations else []
        notable = [f"{e['label']}: {e['observed']} {e['unit']}" for e in exps if e.get('contribution') in ('strong', 'moderate')]
        summary = '; '.join(notable) if notable else 'Within normal peer baselines'

        return {
            'id': self.id,
            'financial_record_id': self.financial_record_id,
            'record_id': self.financial_record.record_id if self.financial_record else None,
            'region': self.financial_record.region if self.financial_record else None,
            'model_version': self.model_version,
            'anomaly_score': float(self.anomaly_score) if self.anomaly_score is not None else None,
            'isolation_forest_score': float(self.anomaly_score) if self.anomaly_score is not None else None,
            'is_anomaly': bool(self.is_anomaly) if self.is_anomaly is not None else False,
            'risk_level': self.risk_level,
            'risk_score': float(self.risk_score) if self.risk_score is not None else None,
            'features': json.loads(self.features) if self.features else {},
            'explanations': exps,
            'explanation': {'summary': summary, 'items': exps},
            'summary': summary,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Risk Cases
# ---------------------------------------------------------------------------

class RiskCase(db.Model):
    __tablename__ = 'risk_cases'

    id = db.Column(db.Integer, primary_key=True)
    case_number = db.Column(db.String(40), unique=True, nullable=False, index=True)
    financial_record_id = db.Column(db.Integer, db.ForeignKey('financial_records.id'), nullable=False)
    anomaly_result_id = db.Column(db.Integer, db.ForeignKey('anomaly_results.id'), nullable=True)
    risk_level = db.Column(db.String(12), nullable=False, index=True)
    risk_score = db.Column(db.Float)
    status = db.Column(db.String(30), default='New', nullable=False, index=True)
    priority = db.Column(db.String(12), default='Medium')
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    title = db.Column(db.String(200))
    description = db.Column(db.Text)
    summary = db.Column(db.Text)
    resolution = db.Column(db.Text)
    resolution_code = db.Column(db.String(40))
    due_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)

    STATUS_NEW = 'New'
    STATUS_ASSIGNED = 'Assigned'
    STATUS_UNDER_REVIEW = 'Under Review'
    STATUS_NEEDS_INFO = 'Needs Information'
    STATUS_ESCALATED = 'Escalated'
    STATUS_RESOLVED = 'Resolved'
    STATUS_CLOSED = 'Closed'

    VALID_STATUSES = (
        STATUS_NEW, STATUS_ASSIGNED, STATUS_UNDER_REVIEW,
        STATUS_NEEDS_INFO, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_CLOSED
    )

    VALID_TRANSITIONS = {
        STATUS_NEW: {STATUS_ASSIGNED, STATUS_UNDER_REVIEW},
        STATUS_ASSIGNED: {STATUS_UNDER_REVIEW, STATUS_NEEDS_INFO, STATUS_ESCALATED, STATUS_CLOSED},
        STATUS_UNDER_REVIEW: {STATUS_NEEDS_INFO, STATUS_ESCALATED, STATUS_RESOLVED, STATUS_ASSIGNED},
        STATUS_NEEDS_INFO: {STATUS_UNDER_REVIEW, STATUS_ESCALATED, STATUS_CLOSED},
        STATUS_ESCALATED: {STATUS_UNDER_REVIEW, STATUS_RESOLVED, STATUS_CLOSED},
        STATUS_RESOLVED: {STATUS_CLOSED, STATUS_UNDER_REVIEW},
        STATUS_CLOSED: {STATUS_UNDER_REVIEW},
    }

    VALID_PRIORITIES = ('Low', 'Medium', 'High', 'Critical')

    # Relationships
    financial_record = db.relationship('FinancialRecord', back_populates='cases')
    anomaly_result = db.relationship('AnomalyResult')
    assignee = db.relationship('User', foreign_keys=[assigned_to], back_populates='assigned_cases')
    events = db.relationship('CaseEvent', back_populates='case', order_by='CaseEvent.created_at.desc()', lazy='dynamic')

    def to_dict(self, include_events=False):
        d = {
            'id': self.id,
            'case_number': self.case_number,
            'financial_record_id': self.financial_record_id,
            'record_id': self.financial_record.record_id if self.financial_record else None,
            'region': self.financial_record.region if self.financial_record else None,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'status': self.status,
            'priority': self.priority,
            'assigned_to': self.assigned_to,
            'assignee_name': self.assignee.name if self.assignee else None,
            'title': self.title,
            'description': self.description,
            'summary': self.summary,
            'resolution': self.resolution,
            'resolution_code': self.resolution_code,
            'due_at': self.due_at.isoformat() if self.due_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_events:
            d['events'] = [e.to_dict() for e in self.events.limit(50).all()]
        return d


class CaseEvent(db.Model):
    __tablename__ = 'case_events'

    id = db.Column(db.Integer, primary_key=True)
    case_id = db.Column(db.Integer, db.ForeignKey('risk_cases.id'), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(60), nullable=False)
    field_changed = db.Column(db.String(40))
    old_value = db.Column(db.Text)
    new_value = db.Column(db.Text)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    case = db.relationship('RiskCase', back_populates='events')
    actor = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'field_changed': self.field_changed,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'comment': self.comment,
            'actor_name': self.actor.name if self.actor else 'System',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Complaints
# ---------------------------------------------------------------------------

class Complaint(db.Model):
    __tablename__ = 'complaints'

    id = db.Column(db.Integer, primary_key=True)
    reference_id = db.Column(db.String(40), unique=True, nullable=False, index=True)
    user_text = db.Column(db.Text, nullable=False)
    language = db.Column(db.String(16))
    category = db.Column(db.String(60))
    sentiment = db.Column(db.String(16))
    urgency = db.Column(db.String(16))
    priority = db.Column(db.String(16), default='Medium')
    confidence = db.Column(db.Float)
    status = db.Column(db.String(30), default='Open', index=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    resolution = db.Column(db.Text)
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)

    assignee = db.relationship('User', foreign_keys=[assigned_to])
    submitter = db.relationship('User', foreign_keys=[submitted_by])
    events = db.relationship('ComplaintEvent', back_populates='complaint', order_by='ComplaintEvent.created_at.desc()', lazy='dynamic')

    VALID_STATUSES = ('Open', 'Under Review', 'In Progress', 'Resolved', 'Closed', 'Rejected')

    def to_dict(self):
        return {
            'id': self.id,
            'reference_id': self.reference_id,
            'user_text': self.user_text,
            'language': self.language,
            'category': self.category,
            'sentiment': self.sentiment,
            'urgency': self.urgency,
            'priority': self.priority,
            'confidence': self.confidence,
            'status': self.status,
            'assigned_to': self.assigned_to,
            'assignee_name': self.assignee.name if self.assignee else None,
            'resolution': self.resolution,
            'submitted_by': self.submitted_by,
            'submitter_name': self.submitter.name if self.submitter else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class ComplaintEvent(db.Model):
    __tablename__ = 'complaint_events'

    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id'), nullable=False, index=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(60), nullable=False)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    complaint = db.relationship('Complaint', back_populates='events')
    actor = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'comment': self.comment,
            'actor_name': self.actor.name if self.actor else 'System',
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Audit Logs
# ---------------------------------------------------------------------------

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(60), nullable=False, index=True)
    resource_type = db.Column(db.String(40))
    resource_id = db.Column(db.String(40))
    details = db.Column(db.Text)           # JSON
    ip_address = db.Column(db.String(45))
    request_id = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False, index=True)

    actor = db.relationship('User')

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'actor_id': self.actor_id,
            'actor_name': self.actor.name if self.actor else 'System',
            'action': self.action,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'details': json.loads(self.details) if self.details else None,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class Report(db.Model):
    __tablename__ = 'reports'

    id = db.Column(db.Integer, primary_key=True)
    report_id = db.Column(db.String(40), unique=True, nullable=False)
    report_type = db.Column(db.String(40), nullable=False)
    title = db.Column(db.String(200))
    filters = db.Column(db.Text)           # JSON
    format = db.Column(db.String(10), default='csv')
    file_path = db.Column(db.String(500))
    status = db.Column(db.String(20), default='Completed')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    creator = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id,
            'report_id': self.report_id,
            'report_type': self.report_type,
            'title': self.title,
            'format': self.format,
            'status': self.status,
            'created_by': self.created_by,
            'creator_name': self.creator.name if self.creator else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text)
    type = db.Column(db.String(30), default='info')
    resource_type = db.Column(db.String(40))
    resource_id = db.Column(db.String(40))
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    user = db.relationship('User', back_populates='notifications')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'message': self.message,
            'type': self.type,
            'resource_type': self.resource_type,
            'resource_id': self.resource_id,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Model Governance
# ---------------------------------------------------------------------------

class ModelVersion(db.Model):
    __tablename__ = 'model_versions'

    id = db.Column(db.Integer, primary_key=True)
    version = db.Column(db.String(40), unique=True, nullable=False)
    algorithm = db.Column(db.String(60), nullable=False)
    features = db.Column(db.Text)           # JSON list of feature names
    config = db.Column(db.Text)             # JSON model config
    training_records = db.Column(db.Integer)
    artifact_path = db.Column(db.String(500))
    metrics = db.Column(db.Text)            # JSON evaluation metrics
    status = db.Column(db.String(20), default='Active')
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    runs = db.relationship('ModelRun', back_populates='model_version', lazy='dynamic')
    creator = db.relationship('User')

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'version': self.version,
            'algorithm': self.algorithm,
            'features': json.loads(self.features) if self.features else [],
            'config': json.loads(self.config) if self.config else {},
            'training_records': self.training_records,
            'metrics': json.loads(self.metrics) if self.metrics else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class ModelRun(db.Model):
    __tablename__ = 'model_runs'

    id = db.Column(db.Integer, primary_key=True)
    model_version_id = db.Column(db.Integer, db.ForeignKey('model_versions.id'), nullable=False)
    records_analyzed = db.Column(db.Integer)
    anomalies_found = db.Column(db.Integer)
    duration_seconds = db.Column(db.Float)
    status = db.Column(db.String(20), default='Completed')
    triggered_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)

    model_version = db.relationship('ModelVersion', back_populates='runs')
    results = db.relationship('AnomalyResult', back_populates='model_run', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'model_version': self.model_version.version if self.model_version else None,
            'records_analyzed': self.records_analyzed,
            'anomalies_found': self.anomalies_found,
            'duration_seconds': self.duration_seconds,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Imports
# ---------------------------------------------------------------------------

class Import(db.Model):
    __tablename__ = 'imports'

    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255))
    status = db.Column(db.String(20), default='Pending')
    total_rows = db.Column(db.Integer, default=0)
    valid_rows = db.Column(db.Integer, default=0)
    error_rows = db.Column(db.Integer, default=0)
    errors = db.Column(db.Text)             # JSON
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)
    completed_at = db.Column(db.DateTime)

    creator = db.relationship('User')

    VALID_STATUSES = ('Pending', 'Validating', 'Processing', 'Completed', 'Failed')

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'filename': self.original_filename or self.filename,
            'status': self.status,
            'total_rows': self.total_rows,
            'valid_rows': self.valid_rows,
            'error_rows': self.error_rows,
            'errors': json.loads(self.errors) if self.errors else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


# ---------------------------------------------------------------------------
# System Settings
# ---------------------------------------------------------------------------

class SystemSetting(db.Model):
    __tablename__ = 'system_settings'

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(80), unique=True, nullable=False)
    value = db.Column(db.Text)
    category = db.Column(db.String(40))
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    updated_at = db.Column(db.DateTime, default=_utcnow, onupdate=_utcnow)


# ---------------------------------------------------------------------------
# Token Blocklist (for JWT logout / revocation)
# ---------------------------------------------------------------------------

class TokenBlocklist(db.Model):
    __tablename__ = 'token_blocklist'

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(120), unique=True, nullable=False, index=True)
    token_type = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=_utcnow, nullable=False)
