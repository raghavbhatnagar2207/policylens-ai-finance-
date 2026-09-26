"""Health and readiness endpoints."""

from flask import Blueprint, current_app
from app.extensions import db

health_bp = Blueprint('health', __name__)


@health_bp.get('/health')
@health_bp.get('/api/v1/health')
def health():
    return {'status': 'ok', 'service': 'policylens-api'}


@health_bp.get('/ready')
@health_bp.get('/api/v1/ready')
def ready():
    """Check database connectivity."""
    try:
        db.session.execute(db.text('SELECT 1'))
        return {'status': 'ready', 'database': 'connected'}
    except Exception:
        current_app.logger.exception("Database readiness check failed")
        return {'status': 'not_ready', 'database': 'unavailable'}, 503
