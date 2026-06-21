"""Photo schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class PhotoResponse(CamelModel):
    """Photo information with signed URLs."""

    id: str
    user_id: str
    storage_path: str
    thumbnail_path: str | None = None
    file_name: str | None = None
    file_size: int | None = None
    width: int | None = None
    height: int | None = None
    caption: str | None = None
    metadata: dict = Field(default_factory=dict)
    created_at: datetime
    thumbnail_url: str | None = None
    image_url: str | None = None


class PhotoListResponse(CamelModel):
    """Paginated photo list."""

    photos: list[PhotoResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


class PhotoShareResponse(CamelModel):
    """Photo share URL response."""

    photo_id: str
    share_url: str
    expires_at: datetime


class GallerySessionResponse(CamelModel):
    """Temporary gallery session for QR access."""

    token: str
    expires_at: datetime
    session_url: str


class GallerySessionPhotosResponse(CamelModel):
    """Public gallery session photo list."""

    photos: list[PhotoResponse]
    total: int
    page: int
    page_size: int
    has_more: bool
    expires_at: datetime
