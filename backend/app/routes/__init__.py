"""Route registration — all API v1 blueprints."""


def register_routes(app):
    from app.routes.auth import auth_bp
    from app.routes.dashboard import dashboard_bp
    from app.routes.financial import financial_bp
    from app.routes.anomalies import anomalies_bp
    from app.routes.cases import cases_bp
    from app.routes.complaints import complaints_bp
    from app.routes.reports import reports_bp
    from app.routes.regions import regions_bp
    from app.routes.admin import admin_bp
    from app.routes.health import health_bp
    from app.routes.notifications import notifications_bp
    from app.routes.imports import imports_bp

    prefix = '/api/v1'
    app.register_blueprint(auth_bp, url_prefix=f'{prefix}/auth')
    app.register_blueprint(dashboard_bp, url_prefix=f'{prefix}/dashboard')
    app.register_blueprint(financial_bp, url_prefix=f'{prefix}/financial-records')
    app.register_blueprint(anomalies_bp, url_prefix=f'{prefix}/anomalies')
    app.register_blueprint(cases_bp, url_prefix=f'{prefix}/cases')
    app.register_blueprint(complaints_bp, url_prefix=f'{prefix}/complaints')
    app.register_blueprint(reports_bp, url_prefix=f'{prefix}/reports')
    app.register_blueprint(regions_bp, url_prefix=f'{prefix}/regions')
    app.register_blueprint(admin_bp, url_prefix=f'{prefix}/admin')
    app.register_blueprint(health_bp, url_prefix='')
    app.register_blueprint(notifications_bp, url_prefix=f'{prefix}/notifications')
    app.register_blueprint(imports_bp, url_prefix=f'{prefix}/imports')
