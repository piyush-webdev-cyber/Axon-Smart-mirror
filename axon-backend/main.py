"""Railway / Docker entrypoint shim.

Allows: uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from app.main import app

__all__ = ["app"]
