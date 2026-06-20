"""Supabase client provider.

The client is created lazily and cached so the app boots even before Supabase
credentials are configured (useful in local dev / CI). Two flavors:

* anon client  - respects Row Level Security (acts as the end user)
* service client - bypasses RLS for trusted server-side operations (use sparingly)
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


@lru_cache
def get_supabase() -> Client | None:
    """Anon-key client. Returns None if Supabase is not configured."""
    if not settings.supabase_url or not settings.supabase_anon_key:
        logger.warning("Supabase anon client not configured; returning None.")
        return None
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache
def get_supabase_admin() -> Client | None:
    """Service-role client (bypasses RLS). Returns None if not configured."""
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.warning("Supabase admin client not configured; returning None.")
        return None
    return create_client(
        settings.supabase_url, settings.supabase_service_role_key
    )
