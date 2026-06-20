"""Authentication schemas."""

from __future__ import annotations

from app.schemas.common import CamelModel


class SessionResponse(CamelModel):
    """Returned after verifying a Supabase access token."""

    user_id: str
    email: str | None = None
    role: str | None = None
    authenticated: bool = True


class MessageResponse(CamelModel):
    message: str
