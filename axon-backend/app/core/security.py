"""Authentication primitives.

Verifies Supabase-issued JWTs (HS256, signed with the project's JWT secret) and
extracts the authenticated user. This keeps the backend stateless: the frontend
authenticates with Supabase, then forwards the access token as a Bearer header.
"""

from __future__ import annotations

from dataclasses import dataclass

import jwt

from app.core.config import settings
from app.core.errors import UnauthorizedError


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None
    role: str | None
    claims: dict


def decode_supabase_jwt(token: str) -> AuthenticatedUser:
    """Validate a Supabase access token and return the user, or raise."""
    if not settings.supabase_jwt_secret:
        # Misconfiguration: refuse to "succeed" silently.
        raise UnauthorizedError("Auth is not configured on the server.")

    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid authentication token.") from exc

    user_id = claims.get("sub")
    if not user_id:
        raise UnauthorizedError("Token is missing a subject claim.")

    return AuthenticatedUser(
        id=user_id,
        email=claims.get("email"),
        role=claims.get("role"),
        claims=claims,
    )
