"""Audit logging service — records important actions for compliance."""

import json
from flask import request
from flask_jwt_extended import get_jwt_identity
from app.extensions import db
from app.models import AuditLog


def _sanitize_details(d):
    if not isinstance(d, dict):
        return d
    sanitized = {}
    for k, v in d.items():
        if any(secret_word in k.lower() for secret_word in ('password', 'token', 'secret', 'authorization', 'bearer')):
            sanitized[k] = '[REDACTED]'
        elif isinstance(v, dict):
            sanitized[k] = _sanitize_details(v)
        else:
            sanitized[k] = v
    return sanitized


def log_action(action, resource_type=None, resource_id=None, details=None, actor_id=None):
    """Create an audit log entry.

    Should NEVER log passwords, tokens, or sensitive secrets.
    """
    if actor_id is None:
        try:
            actor_id = int(get_jwt_identity())
        except Exception:
            actor_id = None

    ip = None
    req_id = None
    try:
        ip = request.remote_addr
        from flask import g
        req_id = getattr(g, 'request_id', None)
    except RuntimeError:
        pass

    safe_details = _sanitize_details(details) if details else None

    entry = AuditLog(
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        details=json.dumps(safe_details) if safe_details else None,
        ip_address=ip,
        request_id=req_id,
    )
    db.session.add(entry)
    # Caller is expected to commit with the rest of their transaction.
