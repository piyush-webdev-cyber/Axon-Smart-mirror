"""Shared API dependencies.

`get_current_user` is the single gate for protected routes: it extracts the
Bearer token, verifies the Supabase JWT, and yields a typed user.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import UnauthorizedError
from app.core.security import AuthenticatedUser, decode_supabase_jwt

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
) -> AuthenticatedUser:
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Missing authentication token.")
    return decode_supabase_jwt(credentials.credentials)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
