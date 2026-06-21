"""Gallery session API routes for QR phone access."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import PhotoUser, get_gallery_session_service, get_photo_service
from app.schemas.photo import GallerySessionPhotosResponse, GallerySessionResponse
from app.services.gallery_session_service import GallerySessionService
from app.services.photo_service import PhotoService
from app.websockets.events import WsEvent
from app.websockets.manager import connection_manager

router = APIRouter(prefix="/gallery", tags=["gallery"])


def _session_page_url(request: Request, token: str) -> str:
    origin = request.headers.get("origin") or str(request.base_url).rstrip("/")
    if "5173" in origin or "localhost" in origin:
        return f"{origin}/gallery/session/{token}"
    return f"{origin}/gallery/session/{token}"


@router.post("/sessions", response_model=GallerySessionResponse)
async def create_gallery_session(
    request: Request,
    user: PhotoUser,
    gallery_service: GallerySessionService = Depends(get_gallery_session_service),
):
    """Create a temporary gallery session and return a QR-friendly URL."""
    session = await gallery_service.create_session(user.id)
    session_url = _session_page_url(request, session["token"])

    await connection_manager.send_to_user(
        user.id,
        WsEvent.GALLERY_OPENED,
        {"token": session["token"], "expiresAt": session["expires_at"]},
    )

    return GallerySessionResponse(
        token=session["token"],
        expires_at=session["expires_at"],
        session_url=session_url,
    )


@router.get("/sessions/{token}/photos", response_model=GallerySessionPhotosResponse)
async def get_session_photos(
    token: str,
    page: int = 1,
    page_size: int = 50,
    gallery_service: GallerySessionService = Depends(get_gallery_session_service),
    photo_service: PhotoService = Depends(get_photo_service),
):
    """Public endpoint — list photos for a valid gallery session token."""
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Page size must be between 1 and 100")

    session = await gallery_service.get_session(token)
    result = await photo_service.list_photos_for_session(
        session["user_id"],
        page,
        page_size,
    )

    from app.schemas.photo import PhotoResponse

    photos = [PhotoResponse(**photo) for photo in result["photos"]]
    expires_at = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))

    return GallerySessionPhotosResponse(
        photos=photos,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        has_more=result["has_more"],
        expires_at=expires_at,
    )
