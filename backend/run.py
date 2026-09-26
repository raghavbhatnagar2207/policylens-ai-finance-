"""Development server entry point — NOT for production."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app import create_app

app = create_app()
if __name__ == '__main__':
    is_debug = app.config.get('DEBUG', False)
    app.run(host='127.0.0.1', port=5000, debug=is_debug)
