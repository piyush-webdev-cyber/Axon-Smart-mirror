"""Authentication primitives.

Verifies Supabase-issued JWTs and extracts the authenticated user. Supports
legacy HS256 tokens (signed with the project JWT secret) and modern asymmetric
tokens (ES256/RS256 via Supabase JWKS). Falls back to Supabase Auth when local
verification cannot determine the signing key.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from app.core.config import settings
from app.core.errors import UnauthorizedError
from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None
    role: str | None
    claims: dict


def _supabase_project_url() -> str:
    """Normalize SUPABASE_URL to the project root (no /rest/v1 suffix)."""
    base = (settings.supabase_url or "").rstrip("/")
    if base.endswith("/rest/v1"):
        base = base[: -len("/rest/v1")]
    return base


def _jwks_url() -> str | None:
    base = _supabase_project_url()
    if not base:
        return None
    return f"{base}/auth/v1/.well-known/jwks.json"


@lru_cache
def _get_jwks_client() -> PyJWKClient | None:
    url = _jwks_url()
    if not url:
        return None
    return PyJWKClient(url, cache_keys=True)


def _claims_to_user(claims: dict) -> AuthenticatedUser:
    user_id = claims.get("sub")
    if not user_id:
        raise UnauthorizedError("Token is missing a subject claim.")

    return AuthenticatedUser(
        id=user_id,
        email=claims.get("email"),
        role=claims.get("role"),
        claims=claims,
    )


def _decode_with_jwks(token: str) -> AuthenticatedUser:
    client = _get_jwks_client()
    if client is None:
        raise jwt.InvalidTokenError("JWKS client is not configured.")

    signing_key = client.get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
        options={"verify_aud": True},
    )
    return _claims_to_user(claims)


def _decode_with_hs256(token: str) -> AuthenticatedUser:
    if not settings.supabase_jwt_secret:
        raise jwt.InvalidTokenError("HS256 secret is not configured.")

    claims = jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
        options={"verify_aud": True},
    )
    return _claims_to_user(claims)


def _decode_with_supabase_auth(token: str) -> AuthenticatedUser:
    """Ask Supabase Auth to validate the token (last-resort fallback)."""
    from app.db.supabase import get_supabase

    client = get_supabase()
    if client is None:
        raise UnauthorizedError("Auth is not configured on the server.")

    try:
        response = client.auth.get_user(token)
    except Exception as exc:
        logger.debug("Supabase auth.get_user failed: %s", exc)
        raise UnauthorizedError("Invalid authentication token.") from exc

    if not response or not response.user:
        raise UnauthorizedError("Invalid authentication token.")

    auth_user = response.user
    return AuthenticatedUser(
        id=auth_user.id,
        email=auth_user.email,
        role=getattr(auth_user, "role", None),
        claims={},
    )


def decode_supabase_jwt(token: str) -> AuthenticatedUser:
    """Validate a Supabase access token and return the user, or raise."""
    if not token or not token.strip():
        raise UnauthorizedError("Missing authentication token.")

    token = token.strip()

    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as exc:
        raise UnauthorizedError("Invalid authentication token.") from exc

    algorithm = header.get("alg", "HS256")

    try:
        if algorithm in {"ES256", "RS256"}:
            return _decode_with_jwks(token)
        if algorithm == "HS256":
            return _decode_with_hs256(token)

        logger.warning("Unsupported JWT algorithm %s; trying JWKS then Supabase Auth", algorithm)
        try:
            return _decode_with_jwks(token)
        except jwt.InvalidTokenError:
            return _decode_with_supabase_auth(token)

    except jwt.ExpiredSignatureError as exc:
        raise UnauthorizedError("Token has expired.") from exc
    except jwt.InvalidTokenError:
        # Legacy projects may still issue HS256 while the header says ES256, or vice versa.
        for decoder in (_decode_with_jwks, _decode_with_hs256):
            try:
                return decoder(token)
            except jwt.InvalidTokenError:
                continue

        try:
            return _decode_with_supabase_auth(token)
        except UnauthorizedError:
            raise
        except Exception as exc:
            raise UnauthorizedError("Invalid authentication token.") from exc
