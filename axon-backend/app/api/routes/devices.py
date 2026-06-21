"""Device linking API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import CurrentUser, get_device_service
from app.schemas.device import (
    DeviceCodeCreate,
    DeviceCodeResponse,
    DeviceLinkRequest,
    DeviceLinkResponse,
    DeviceStatusResponse,
)
from app.services.device_service import DeviceService

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/codes", response_model=DeviceCodeResponse)
async def create_device_code(
    device_service: DeviceService = Depends(get_device_service),
):
    """Create a new device code for linking (mirror calls this on startup).

    No authentication required - any device can request a code.
    """
    device_code = await device_service.create_device_code()
    return DeviceCodeResponse(
        id=device_code["id"],
        code=device_code["code"],
        status=device_code["status"],
        expires_at=device_code["expires_at"],
        created_at=device_code["created_at"],
    )


@router.get("/codes/{code}/status", response_model=DeviceStatusResponse)
async def check_device_status(
    code: str,
    device_service: DeviceService = Depends(get_device_service),
):
    """Check the status of a device code (mirror polls this).

    No authentication required - public endpoint for device status checking.
    """
    status = await device_service.check_device_status(code)
    return DeviceStatusResponse(**status)


@router.post("/link", response_model=DeviceLinkResponse)
async def link_device(
    request: DeviceLinkRequest,
    user: CurrentUser,
    device_service: DeviceService = Depends(get_device_service),
):
    """Link a device code to the authenticated user's account (phone calls this).

    Requires authentication - user must be logged in.
    """
    try:
        device_code = await device_service.link_device(request.code, user.id)

        # Fetch user profile for response
        status = await device_service.check_device_status(request.code)

        return DeviceLinkResponse(
            success=True,
            message="Device linked successfully",
            user_id=user.id,
            display_name=status.get("display_name"),
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
