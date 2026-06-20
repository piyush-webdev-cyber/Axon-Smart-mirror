"""User profile + settings endpoints (current user only)."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import CurrentUser
from app.schemas.user import (
    UserProfile,
    UserProfileUpdate,
    UserSettings,
    UserSettingsUpdate,
)
from app.services import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserProfile, summary="Get my profile")
async def get_me(user: CurrentUser) -> UserProfile:
    return user_service.get_profile(user)


@router.patch("/me", response_model=UserProfile, summary="Update my profile")
async def update_me(user: CurrentUser, payload: UserProfileUpdate) -> UserProfile:
    return user_service.update_profile(user, payload)


@router.get(
    "/me/settings", response_model=UserSettings, summary="Get my settings"
)
async def get_my_settings(user: CurrentUser) -> UserSettings:
    return user_service.get_settings(user)


@router.patch(
    "/me/settings", response_model=UserSettings, summary="Update my settings"
)
async def update_my_settings(
    user: CurrentUser, payload: UserSettingsUpdate
) -> UserSettings:
    return user_service.update_settings(user, payload)
