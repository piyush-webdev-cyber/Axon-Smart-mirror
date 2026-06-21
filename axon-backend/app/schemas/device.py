"""Device linking schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DeviceCodeCreate(BaseModel):
    """Request to create a new device code."""

    pass  # No input needed, code is auto-generated


class DeviceCodeResponse(BaseModel):
    """Device code information."""

    id: str
    code: str
    status: Literal["pending", "linked", "expired"]
    expires_at: datetime
    created_at: datetime


class DeviceLinkRequest(BaseModel):
    """Request to link a device to a user account."""

    code: str = Field(..., min_length=8, max_length=12)


class DeviceLinkResponse(BaseModel):
    """Device link result."""

    success: bool
    message: str
    user_id: str | None = None
    display_name: str | None = None


class DeviceStatusResponse(BaseModel):
    """Device status check response."""

    status: Literal["pending", "linked", "expired"]
    user_id: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    mirror_token: str | None = None
