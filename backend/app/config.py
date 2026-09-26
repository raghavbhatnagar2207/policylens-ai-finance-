import os
from datetime import timedelta


class Config:
    """Base configuration."""
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ['headers']
    JWT_BLOCKLIST_ENABLED = True
    JWT_BLOCKLIST_TOKEN_CHECKS = ['access', 'refresh']
    RATELIMIT_STORAGE_URI = os.getenv('RATELIMIT_STORAGE_URI', 'memory://')
    RATELIMIT_HEADERS_ENABLED = True
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB upload limit
    UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')
    REPORT_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'reports')
    ML_ARTIFACT_FOLDER = os.path.join(os.path.dirname(__file__), 'ml', 'artifacts')
    PAGINATION_DEFAULT_PAGE = 1
    PAGINATION_DEFAULT_PER_PAGE = 25
    PAGINATION_MAX_PER_PAGE = 100

    @staticmethod
    def _require_env(key):
        val = os.getenv(key)
        if not val:
            raise RuntimeError(f"Required environment variable '{key}' is not set.")
        return val


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'sqlite:///policylens.db')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-only-change-me-in-production-32bytes!')
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_SECRET_KEY = 'test-secret-key-at-least-32-bytes-long-for-hmac'
    CORS_ORIGINS = '*'
    WTF_CSRF_ENABLED = False
    RATELIMIT_ENABLED = False


class ProductionConfig(Config):
    DEBUG = False
    _raw_db = os.getenv('DATABASE_URL', '')
    if _raw_db and _raw_db.startswith('postgres://'):
        _raw_db = _raw_db.replace('postgres://', 'postgresql://', 1)
    SQLALCHEMY_DATABASE_URI = _raw_db
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*')
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 10,
        'pool_recycle': 300,
        'pool_pre_ping': True,
    }

    @classmethod
    def validate(cls):
        for key in ['DATABASE_URL', 'JWT_SECRET_KEY']:
            val = cls._require_env(key)
            if any(p in val.lower() for p in ('change-me', 'dev-only', 'replace-in-real', 'test-secret')):
                raise RuntimeError(f"Production environment variable '{key}' cannot use default or placeholder values.")
        jwt_key = os.getenv('JWT_SECRET_KEY', '')
        if len(jwt_key) < 32:
            raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters in production.")


config_by_name = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
}


def get_config():
    env = os.getenv('FLASK_ENV', 'development')
    cfg = config_by_name.get(env, DevelopmentConfig)
    if env == 'production' and hasattr(cfg, 'validate'):
        cfg.validate()
    return cfg
