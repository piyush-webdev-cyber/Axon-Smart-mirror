"""Device linking API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import CurrentUser, get_device_service
from app.schemas.device import (
    DeviceCodeResponse,
    DeviceLinkRequest,
    DeviceLinkResponse,
    DeviceStatusResponse,
)
from app.services.device_service import DeviceService
from app.websockets.events import WsEvent
from app.websockets.manager import connection_manager

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
        normalized_code = request.code.strip().upper()
        await device_service.link_device(normalized_code, user.id)

        status = await device_service.check_device_status(normalized_code)

        await connection_manager.broadcast(
            WsEvent.DEVICE_LINKED,
            {
                "code": normalized_code,
                "userId": user.id,
                "displayName": status.get("display_name"),
                "email": status.get("email") or user.email,
                "mirrorToken": status.get("mirror_token"),
            },
        )

        return DeviceLinkResponse(
            success=True,
            message="Device linked successfully",
            user_id=user.id,
            display_name=status.get("display_name"),
            email=status.get("email") or user.email,
            mirror_token=status.get("mirror_token"),
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
