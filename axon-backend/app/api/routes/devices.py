"""Device linking API routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.api.deps import CurrentUser, get_device_service
from app.core.errors import AxonError
from app.core.logging import get_logger
from app.schemas.device import (
    DeviceCodeResponse,
    DeviceLinkRequest,
    DeviceLinkResponse,
    DeviceStatusResponse,
)
from app.services.device_service import DeviceService
from app.websockets.events import WsEvent
from app.websockets.manager import connection_manager

logger = get_logger(__name__)

router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("/codes", response_model=DeviceCodeResponse)
async def create_device_code(
    device_service: DeviceService = Depends(get_device_service),
):
    """Create a new device code for linking (mirror calls this on startup).

    No authentication required - any device can request a code.
    """
    device_code = await device_service.create_device_code()
    logger.info("Device code created: %s", device_code.get("code"))
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
    normalized = code.strip().upper()
    logger.info("Device status check: code=%s", normalized)
    status = await device_service.check_device_status(normalized)
    return DeviceStatusResponse(**status)


@router.post("/link", response_model=DeviceLinkResponse)
async def link_device(
    request: Request,
    body: DeviceLinkRequest,
    user: CurrentUser,
    device_service: DeviceService = Depends(get_device_service),
):
    """Link a device code to the authenticated user's account (phone calls this).

    Requires authentication - user must be logged in.
    """
    normalized_code = body.code.strip().upper()
    logger.info(
        "Device link request | code=%s | user_id=%s | origin=%s",
        normalized_code,
        user.id,
        request.headers.get("origin"),
    )

    try:
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

        logger.info("Device linked successfully | code=%s | user_id=%s", normalized_code, user.id)

        return DeviceLinkResponse(
            success=True,
            message="Device linked successfully",
            user_id=user.id,
            display_name=status.get("display_name"),
            email=status.get("email") or user.email,
            mirror_token=status.get("mirror_token"),
        )

    except ValidationError as exc:
        logger.warning(
            "Device link validation error | code=%s | errors=%s",
            normalized_code,
            exc.errors(),
        )
        raise HTTPException(
            status_code=422,
            detail={"message": "Invalid link request.", "errors": exc.errors()},
        ) from exc
    except RequestValidationError as exc:
        logger.warning(
            "Device link request validation error | code=%s | errors=%s",
            normalized_code,
            exc.errors(),
        )
        raise HTTPException(
            status_code=422,
            detail={"message": "Invalid link request.", "errors": exc.errors()},
        ) from exc
    except AxonError as exc:
        logger.warning(
            "Device link rejected | code=%s | user_id=%s | status=%s | message=%s",
            normalized_code,
            user.id,
            exc.status_code,
            exc.message,
        )
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(
            "Device link failed | code=%s | user_id=%s | error=%s",
            normalized_code,
            user.id,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail={"message": "Failed to link device.", "error": str(exc)},
        ) from exc
