"""Mirror device authentication via linked device tokens."""

from __future__ import annotations

from app.core.errors import UnauthorizedError
from app.core.security import AuthenticatedUser
from app.db.supabase import get_supabase_admin


def _resolve_fallback_mirror_user(mirror_token: str) -> AuthenticatedUser | None:
    """Storage or in-memory device codes when Supabase table is not migrated."""
    from app.services.device_service import DeviceService

    if DeviceService._storage_backend not in ("storage", "memory"):
        return None

    records: list[dict] = []
    if DeviceService._storage_backend == "memory":
        records = list(DeviceService._dev_codes.values())
    else:
        # Scan storage prefix is expensive; check linked_meta and known codes only.
        records = list(DeviceService._dev_codes.values())

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
    except Exception:
        dev_user = _resolve_fallback_mirror_user(mirror_token)
        if dev_user:
            return dev_user
        raise UnauthorizedError("Invalid mirror token.") from None

    record = result.data
    if not record or not record.get("user_id"):
        raise UnauthorizedError("Invalid mirror token.")

    return AuthenticatedUser(
        id=str(record["user_id"]),
        email=None,
        role="authenticated",
        claims={"mirror": True},
    )
