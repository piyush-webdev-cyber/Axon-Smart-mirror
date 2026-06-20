"""Supabase Storage wrapper (Phase 1 stub).

Defines the storage seam used by future media features (photo capture, QR photo
sharing, avatars). The interface is stable now; the implementation arrives with
those features.
"""

from __future__ import annotations

from app.core.config import settings
from app.core.errors import NotImplementedYetError
from app.db.supabase import get_supabase_admin


class StorageService:
    def __init__(self) -> None:
        self.bucket = settings.supabase_storage_bucket

    def _client(self):
        client = get_supabase_admin()
        if client is None:
            raise NotImplementedYetError("Storage (Supabase not configured)")
        return client

    async def upload(self, path: str, data: bytes, *, content_type: str) -> str:
        """Reserved for Phase 2+ (photo capture / sharing)."""
        raise NotImplementedYetError("Media upload")

    async def create_signed_url(self, path: str, *, expires_in: int = 3600) -> str:
        """Reserved for Phase 2+ (QR photo sharing)."""
        raise NotImplementedYetError("Signed media URLs")


storage_service = StorageService()
