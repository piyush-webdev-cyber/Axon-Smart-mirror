"""User profile and settings schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class UserProfile(CamelModel):
    id: str
    display_name: str | None = None
    avatar_url: str | None = None
    email: str | None = None
    created_at: datetime


class UserProfileUpdate(CamelModel):
    display_name: str | None = Field(default=None, max_length=120)
    avatar_url: str | None = None


class UserPreferences(CamelModel):
    locale: str = "en-US"
    temperature_unit: Literal["celsius", "fahrenheit"] = "celsius"
    clock_format: Literal["12h", "24h"] = "24h"
    weather_location: str = ""


class UserSettings(CamelModel):
    id: str
    user_id: str
    theme: str = "black-mirror"
    preferences: UserPreferences = Field(default_factory=UserPreferences)


class UserSettingsUpdate(CamelModel):
    theme: str | None = None
    preferences: UserPreferences | None = None
