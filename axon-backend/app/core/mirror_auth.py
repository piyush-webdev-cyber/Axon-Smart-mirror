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


def _resolve_storage_device_code_token(mirror_token: str) -> AuthenticatedUser | None:
    """Scan device-codes/*.json backups for a matching mirror_token."""
    admin = get_supabase_admin()
    if not admin:
        return None

    try:
        bucket = admin.storage.from_(settings.supabase_storage_bucket)
        entries = bucket.list("device-codes")
        for entry in entries or []:
            name = entry.get("name") if isinstance(entry, dict) else getattr(entry, "name", None)
            if not name or not str(name).endswith(".json"):
                continue
            try:
                raw = bucket.download(f"device-codes/{name}")
                record = json.loads(raw.decode("utf-8"))
            except Exception:
                continue
            if record.get("mirror_token") != mirror_token:
                continue
            if record.get("status") != "linked":
                continue
            user_id = record.get("user_id")
            if not user_id:
                continue
            logger.info("[MIRROR_AUTH] device-codes backup hit | user_id=%s", user_id)
            return AuthenticatedUser(
                id=str(user_id),
                email=None,
                role="authenticated",
                claims={"mirror": True},
            )
    except Exception as exc:
        logger.debug("[MIRROR_AUTH] device-codes scan miss | reason=%s", exc)
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

    user = _resolve_storage_device_code_token(mirror_token)
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


async def resolve_mirror_by_linked_code(code: str, user_id: str) -> AuthenticatedUser:
    """Validate mirror kiosk via linked device code + user id (stable fallback)."""
    from app.services.device_service import DeviceService

    admin = get_supabase_admin()
    if not admin:
        raise UnauthorizedError("Mirror authentication is not configured.")

    service = DeviceService(admin)
    status = await service.verify_mirror_session(code.strip().upper(), user_id.strip())

    logger.info(
        "[MIRROR_AUTH] session verified | code=%s | user_id=%s",
        code.strip().upper(),
        user_id,
    )
    return AuthenticatedUser(
        id=str(status["user_id"]),
        email=status.get("email"),
        role="authenticated",
        claims={"mirror": True, "code": code.strip().upper()},
    )


async def resolve_mirror_by_user_id(user_id: str) -> AuthenticatedUser:
    """Find the linked device for a user when the mirror lost its device code."""
    from app.services.device_service import DeviceService

    admin = get_supabase_admin()
    if not admin:
        raise UnauthorizedError("Mirror authentication is not configured.")

    service = DeviceService(admin)
    try:
        result = (
            admin.table("device_codes")
            .select("code, user_id, status, mirror_token")
            .eq("user_id", user_id.strip())
            .eq("status", "linked")
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
    except Exception as exc:
        logger.warning("[MIRROR_AUTH] user_id lookup error | error=%s", exc)
        raise UnauthorizedError("Invalid mirror session.") from None

    if not rows:
        raise UnauthorizedError("Invalid mirror session.")

    row = rows[0]
    code = str(row.get("code") or "")
    if not code:
        raise UnauthorizedError("Invalid mirror session.")

    return await resolve_mirror_by_linked_code(code, user_id)


async def resolve_mirror_session(
    *,
    mirror_token: str | None = None,
    linked_code: str | None = None,
    linked_user_id: str | None = None,
) -> AuthenticatedUser:
    """Try mirror token first, then linked code + user id, then user id alone."""
    if mirror_token:
        try:
            return await resolve_mirror_user(mirror_token)
        except UnauthorizedError:
            logger.warning("[MIRROR_AUTH] token rejected — trying session fallback")

    if linked_code and linked_user_id:
        return await resolve_mirror_by_linked_code(linked_code, linked_user_id)

    if linked_user_id:
        return await resolve_mirror_by_user_id(linked_user_id)

    if mirror_token:
        raise UnauthorizedError("Invalid mirror token.")
    raise UnauthorizedError("Missing mirror authentication.")
