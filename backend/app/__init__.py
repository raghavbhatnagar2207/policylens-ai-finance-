import logging
import os
import uuid
from flask import Flask, jsonify, request, g
from app.config import get_config
from app.extensions import db, jwt, migrate, cors, limiter


def create_app(config_override=None):
    app = Flask(__name__)

    # Configuration
    if isinstance(config_override, str):
        from app.config import config_by_name
        config = config_by_name.get(config_override, get_config())
    else:
        config = config_override or get_config()
    app.config.from_object(config)

    # Ensure required directories exist
    for folder in ('UPLOAD_FOLDER', 'REPORT_FOLDER', 'ML_ARTIFACT_FOLDER'):
        path = app.config.get(folder)
        if path:
            os.makedirs(path, exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    from app import models  # Register models with SQLAlchemy metadata
    migrate.init_app(app, db)
    limiter.init_app(app)

    # Request correlation ID tracking
    @app.before_request
    def set_request_id():
        g.request_id = request.headers.get('X-Request-ID') or str(uuid.uuid4())

    # CORS — parse allowed origins from config
    origins = app.config.get('CORS_ORIGINS', '*')
    if isinstance(origins, str):
        origins = [o.strip() for o in origins.split(',') if o.strip()]
    cors.init_app(app, resources={r'/api/*': {'origins': origins}},
                  supports_credentials=True)

    jwt.init_app(app)

    # JWT blocklist check
    from app.models import TokenBlocklist

    @jwt.token_in_blocklist_loader
    def check_blocklist(jwt_header, jwt_payload):
        jti = jwt_payload['jti']
        return db.session.query(
            TokenBlocklist.query.filter_by(jti=jti).exists()
        ).scalar()

    @jwt.revoked_token_loader
    def revoked_token(jwt_header, jwt_payload):
        return jsonify(success=False, error={
            'code': 'TOKEN_REVOKED', 'message': 'Token has been revoked.'
        }), 401

    @jwt.expired_token_loader
    def expired_token(jwt_header, jwt_payload):
        return jsonify(success=False, error={
            'code': 'TOKEN_EXPIRED', 'message': 'Token has expired.'
        }), 401

    @jwt.unauthorized_loader
    def unauthorized(reason):
        return jsonify(success=False, error={
            'code': 'UNAUTHORIZED', 'message': 'Authentication required.'
        }), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify(success=False, error={
            'code': 'INVALID_TOKEN', 'message': 'Invalid authentication token.'
        }), 401

    # Register routes
    from app.routes import register_routes
    register_routes(app)

    # Error handlers
    @app.errorhandler(404)
    def not_found(e):
        return jsonify(success=False, error={
            'code': 'NOT_FOUND', 'message': 'The requested resource was not found.'
        }), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify(success=False, error={
            'code': 'METHOD_NOT_ALLOWED', 'message': 'Method not allowed.'
        }), 405

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        app.logger.error(f'Internal error: {e}')
        return jsonify(success=False, error={
            'code': 'INTERNAL_ERROR', 'message': 'An unexpected error occurred.'
        }), 500

    @app.errorhandler(413)
    def payload_too_large(e):
        return jsonify(success=False, error={
            'code': 'PAYLOAD_TOO_LARGE', 'message': 'File size exceeds the allowed limit.'
        }), 413

    @app.errorhandler(429)
    def rate_limit_exceeded(e):
        return jsonify(success=False, error={
            'code': 'RATE_LIMIT_EXCEEDED', 'message': 'Rate limit exceeded. Please wait before retrying.'
        }), 429

    # Security headers & correlation ID
    @app.after_request
    def security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        if hasattr(g, 'request_id'):
            response.headers['X-Request-ID'] = g.request_id
        return response

    # Logging
    logging.basicConfig(
        level=logging.DEBUG if app.debug else logging.INFO,
        format='%(asctime)s %(levelname)s [%(name)s] %(message)s',
    )

    return app
