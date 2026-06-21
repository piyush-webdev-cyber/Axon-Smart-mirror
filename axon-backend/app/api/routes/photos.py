"""Photo management API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.api.deps import PhotoUser, get_photo_service
from app.schemas.photo import PhotoListResponse, PhotoResponse, PhotoShareResponse
from app.services.photo_service import PhotoService
from app.websockets.events import WsEvent
from app.websockets.manager import connection_manager

router = APIRouter(prefix="/photos", tags=["photos"])


@router.post("", response_model=PhotoResponse)
async def create_photo(
    user: PhotoUser,
    file: UploadFile = File(...),
    caption: str | None = Form(None),
    photo_service: PhotoService = Depends(get_photo_service),
):
    """Upload a new photo to Supabase Storage."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_data = await file.read()
    if len(image_data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 10MB)")

    await connection_manager.broadcast(
        WsEvent.PHOTO_UPLOAD_STARTED,
        {"userId": user.id},
    )

    photo = await photo_service.create_photo(
        user_id=user.id,
        image_data=image_data,
        filename=file.filename or "photo.jpg",
        caption=caption,
    )

    await connection_manager.send_to_user(
        user.id,
        WsEvent.PHOTO_UPLOAD_COMPLETED,
        {"photoId": photo["id"]},
    )
    await connection_manager.broadcast(
        WsEvent.PHOTO_CREATED,
        {"photoId": photo["id"], "userId": user.id},
    )

    return PhotoResponse(**photo)


@router.get("", response_model=PhotoListResponse)
async def list_photos(
    user: PhotoUser,
    page: int = 1,
    page_size: int = 20,
    photo_service: PhotoService = Depends(get_photo_service),
):
    """List user's photos with pagination."""
    if page < 1:
        raise HTTPException(status_code=400, detail="Page must be >= 1")
    if page_size < 1 or page_size > 100:
        raise HTTPException(status_code=400, detail="Page size must be between 1 and 100")

    result = await photo_service.list_photos(user.id, page, page_size)
    photos = [PhotoResponse(**photo) for photo in result["photos"]]

    return PhotoListResponse(
        photos=photos,
        total=result["total"],
        page=result["page"],
        page_size=result["page_size"],
        has_more=result["has_more"],
    )


@router.get("/{photo_id}", response_model=PhotoResponse)
async def get_photo(
    photo_id: str,
    user: PhotoUser,
    photo_service: PhotoService = Depends(get_photo_service),
):
    """Get a single photo by ID."""
    photo = await photo_service.get_photo(photo_id, user.id)
    return PhotoResponse(**photo)


@router.delete("/{photo_id}", response_model=PhotoResponse)
async def delete_photo(
    photo_id: str,
    user: PhotoUser,
    photo_service: PhotoService = Depends(get_photo_service),
):
    """Delete a photo."""
    photo = await photo_service.delete_photo(photo_id, user.id)
    await connection_manager.send_to_user(
        user.id,
        WsEvent.PHOTO_DELETED,
        {"photoId": photo_id},
    )
    return PhotoResponse(**photo)


@router.post("/{photo_id}/share", response_model=PhotoShareResponse)
async def create_share_url(
    photo_id: str,
    user: PhotoUser,
    photo_service: PhotoService = Depends(get_photo_service),
):
    """Create a temporary signed URL for sharing a photo."""
    share_data = await photo_service.create_share_url(photo_id, user.id)
    return PhotoShareResponse(**share_data)
