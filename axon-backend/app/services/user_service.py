"""User profile + settings service.

Now uses real Supabase integration. The auto-provisioning trigger in the database
creates profile + settings rows on signup, so these functions read/write actual
persisted data.
"""

from __future__ import annotations

from app.core.errors import NotFoundError
from app.core.security import AuthenticatedUser
from app.db.supabase import get_supabase_admin
from app.schemas.user import (
    UserProfile,
    UserProfileUpdate,
    UserSettings,
    UserSettingsUpdate,
)


def get_profile(user: AuthenticatedUser) -> UserProfile:
    """Fetch user profile from Supabase profiles table."""
    client = get_supabase_admin()
    if client is None:
        raise NotFoundError("Database not configured")

    response = client.table("profiles").select("*").eq("id", user.id).execute()

    if not response.data or len(response.data) == 0:
        raise NotFoundError(f"Profile not found for user {user.id}")

    row = response.data[0]
    return UserProfile(
        id=row["id"],
        display_name=row.get("display_name"),
        avatar_url=row.get("avatar_url"),
        email=user.email,
        created_at=row["created_at"],
    )


def update_profile(
    user: AuthenticatedUser, payload: UserProfileUpdate
) -> UserProfile:
    """Update user profile in Supabase profiles table."""
    client = get_supabase_admin()
    if client is None:
        raise NotFoundError("Database not configured")

    updates = payload.model_dump(exclude_none=True, by_alias=False)
    if not updates:
        return get_profile(user)

    client.table("profiles").update(updates).eq("id", user.id).execute()

    return get_profile(user)


def get_settings(user: AuthenticatedUser) -> UserSettings:
    """Fetch user settings from Supabase settings table."""
    client = get_supabase_admin()
    if client is None:
        raise NotFoundError("Database not configured")

    response = client.table("settings").select("*").eq("user_id", user.id).execute()

    if not response.data or len(response.data) == 0:
        raise NotFoundError(f"Settings not found for user {user.id}")

    row = response.data[0]
    return UserSettings(
        id=row["id"],
        user_id=row["user_id"],
        theme=row.get("theme", "black-mirror"),
        preferences=row.get("preferences", {}),
    )


def update_settings(
    user: AuthenticatedUser, payload: UserSettingsUpdate
) -> UserSettings:
    """Update user settings in Supabase settings table."""
    client = get_supabase_admin()
    if client is None:
        raise NotFoundError("Database not configured")

    updates = payload.model_dump(exclude_none=True, by_alias=False)
    if not updates:
        return get_settings(user)

    # Merge preferences if provided (don't overwrite entire object)
    if "preferences" in updates and updates["preferences"] is not None:
        current = get_settings(user)
        merged_prefs = {
            **current.preferences.model_dump(),
            **updates["preferences"].model_dump(exclude_none=True),
        }
        updates["preferences"] = merged_prefs

    client.table("settings").update(updates).eq("user_id", user.id).execute()

    return get_settings(user)
