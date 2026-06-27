"""Mirror device authentication via linked device tokens."""

from __future__ import annotations

import json

from app.core.config import settings
from app.core.errors import UnauthorizedError
from app.core.logging import get_logger
from app.core.security import AuthenticatedUser
from app.db.supabase import get_supabase_admin

logger = get_logger(__name__)

_MIRROR_TOKEN_PREFIX = "mirror-tokens"


def _resolve_linked_meta_token(mirror_token: str) -> AuthenticatedUser | None:
    """In-process token cache when DB column is missing or token not yet replicated."""
    from app.services.device_service import DeviceService

    for meta in DeviceService._linked_meta.values():
        if meta.get("mirror_token") != mirror_token:
            continue
        user_id = meta.get("user_id")
        if not user_id:
            continue
        logger.info("[MIRROR_AUTH] linked_meta hit | user_id=%s", user_id)
        return AuthenticatedUser(
            id=str(user_id),
            email=None,
            role="authenticated",
            claims={"mirror": True, "dev": True},
        )
    return None


def _resolve_storage_mirror_token(mirror_token: str) -> AuthenticatedUser | None:
    """Supabase Storage index written on every successful device link."""
    admin = get_supabase_admin()
    if not admin:
        return None

    try:
        raw = admin.storage.from_(settings.supabase_storage_bucket).download(
            f"{_MIRROR_TOKEN_PREFIX}/{mirror_token}.json"
        )
        record = json.loads(raw.decode("utf-8"))
        user_id = record.get("user_id")
        if not user_id:
            return None
        logger.info("[MIRROR_AUTH] storage index hit | user_id=%s", user_id)
        return AuthenticatedUser(
            id=str(user_id),
            email=None,
            role="authenticated",
            claims={"mirror": True},
        )
    except Exception as exc:
        logger.debug("[MIRROR_AUTH] storage index miss | reason=%s", exc)
        return None


def _resolve_fallback_mirror_user(mirror_token: str) -> AuthenticatedUser | None:
    """Storage or in-memory device codes when Supabase table is not migrated."""
    from app.services.device_service import DeviceService

    user = _resolve_linked_meta_token(mirror_token)
    if user:
        return user

    user = _resolve_storage_mirror_token(mirror_token)
    if user:
        return user

    if DeviceService._storage_backend not in ("storage", "memory"):
        return None

    records: list[dict] = list(DeviceService._dev_codes.values())

    for record in records:
        if record.get("mirror_token") != mirror_token:
            continue
        if record.get("status") != "linked":
            continue
        user_id = record.get("user_id")
        if not user_id:
            continue
        return AuthenticatedUser(
            id=str(user_id),
            email=None,
            role="authenticated",
            claims={"mirror": True, "dev": True},
        )
    return None


async def resolve_mirror_user(mirror_token: str) -> AuthenticatedUser:
    """Validate a mirror token and return the linked user."""
    mirror_token = mirror_token.strip()
    if not mirror_token:
        raise UnauthorizedError("Invalid mirror token.")

    dev_user = _resolve_fallback_mirror_user(mirror_token)
    if dev_user:
        return dev_user

    admin = get_supabase_admin()
    if not admin:
        raise UnauthorizedError("Mirror authentication is not configured.")

    try:
        result = (
            admin.table("device_codes")
            .select("user_id, status")
            .eq("mirror_token", mirror_token)
            .eq("status", "linked")
            .maybe_single()
            .execute()
        )
    except Exception as exc:
        logger.warning("[MIRROR_AUTH] db lookup error | error=%s", exc)
        dev_user = _resolve_fallback_mirror_user(mirror_token)
        if dev_user:
            return dev_user
        raise UnauthorizedError("Invalid mirror token.") from None

    record = result.data
    if not record or not record.get("user_id"):
        dev_user = _resolve_fallback_mirror_user(mirror_token)
        if dev_user:
            return dev_user
        logger.warning("[MIRROR_AUTH] token not found in device_codes")
        raise UnauthorizedError("Invalid mirror token.")

    logger.info("[MIRROR_AUTH] db hit | user_id=%s", record["user_id"])
    return AuthenticatedUser(
        id=str(record["user_id"]),
        email=None,
        role="authenticated",
        claims={"mirror": True},
    )
