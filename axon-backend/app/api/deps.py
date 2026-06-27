"""Shared API dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import AxonError, UnauthorizedError
from app.core.mirror_auth import resolve_mirror_session
from app.core.security import AuthenticatedUser, decode_supabase_jwt
from app.db.supabase import get_supabase, get_supabase_admin

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
) -> AuthenticatedUser:
    """Extract and verify the authenticated user from the Bearer JWT."""
    if credentials is None or not credentials.credentials:
        raise UnauthorizedError("Missing authentication token.")
    return decode_supabase_jwt(credentials.credentials)


async def get_photo_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
    mirror_token: Annotated[str | None, Header(alias="X-Mirror-Token")] = None,
    linked_code: Annotated[str | None, Header(alias="X-Linked-Code")] = None,
    linked_user_id: Annotated[str | None, Header(alias="X-Linked-User-Id")] = None,
) -> AuthenticatedUser:
    """Accept Supabase JWT, mirror token, or linked device session headers."""
    if credentials and credentials.credentials:
        return decode_supabase_jwt(credentials.credentials)
    if mirror_token or linked_user_id:
        return await resolve_mirror_session(
            mirror_token=mirror_token,
            linked_code=linked_code,
            linked_user_id=linked_user_id,
        )
    raise UnauthorizedError("Missing authentication token.")


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
PhotoUser = Annotated[AuthenticatedUser, Depends(get_photo_user)]


def get_device_service():
    """Get device service instance with admin client."""
    from app.services.device_service import DeviceService

    admin_client = get_supabase_admin()
    if not admin_client:
        raise AxonError("Supabase admin client not configured", status_code=500)
    return DeviceService(admin_client)


def get_photo_service():
    """Get photo service instance with admin client (storage + RLS bypass)."""
    from app.services.photo_service import PhotoService

    admin_client = get_supabase_admin()
    if not admin_client:
        raise AxonError("Supabase admin client not configured", status_code=500)
    return PhotoService(admin_client)


def get_gallery_session_service():
    """Get gallery session service with admin client."""
    from app.services.gallery_session_service import GallerySessionService

    admin_client = get_supabase_admin()
    if not admin_client:
        raise AxonError("Supabase admin client not configured", status_code=500)
    return GallerySessionService(admin_client)
