"""Device linking schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class DeviceCodeCreate(CamelModel):
    """Request to create a new device code."""

    pass  # No input needed, code is auto-generated


class DeviceCodeResponse(CamelModel):
    """Device code information."""

    id: str
    code: str
    status: Literal["pending", "linked", "expired"]
    expires_at: datetime
    created_at: datetime


class DeviceLinkRequest(CamelModel):
    """Request to link a device to a user account."""

    code: str = Field(..., min_length=8, max_length=12)


class DeviceLinkResponse(CamelModel):
    """Device link result."""

    success: bool
    message: str
    user_id: str | None = None
    display_name: str | None = None
    email: str | None = None
    mirror_token: str | None = None


class DeviceStatusResponse(CamelModel):
    """Device status check response."""

    status: Literal["pending", "linked", "expired"]
    user_id: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    mirror_token: str | None = None
