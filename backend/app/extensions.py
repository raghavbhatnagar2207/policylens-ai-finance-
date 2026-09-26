"""Centralized Flask extensions — imported once, initialized in create_app."""

import os
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()
cors = CORS()
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=os.getenv('RATELIMIT_STORAGE_URI', 'memory://'),
    default_limits=[],
    headers_enabled=True,
)

