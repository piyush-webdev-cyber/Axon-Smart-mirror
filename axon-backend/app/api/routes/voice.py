"""Voice assistant HTTP routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_supabase_jwt
from app.schemas.voice import VoiceProcessRequest, VoiceProcessResponse, VoiceStatusResponse
from app.services.voice_service import process_voice_command

router = APIRouter(prefix="/voice", tags=["voice"])

_bearer = HTTPBearer(auto_error=False)


def _optional_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> str | None:
    if credentials is None or not credentials.credentials:
        return None
    try:
        return decode_supabase_jwt(credentials.credentials).id
    except Exception:
        return None


@router.get("/status", response_model=VoiceStatusResponse)
async def voice_status() -> VoiceStatusResponse:
    """Voice assistant availability."""
    return VoiceStatusResponse()


@router.post("/process", response_model=VoiceProcessResponse)
async def process_transcript(
    request: VoiceProcessRequest,
    user_id: Annotated[str | None, Depends(_optional_user_id)] = None,
) -> VoiceProcessResponse:
    """Process a speech transcript and return reply + optional action."""
    result = await process_voice_command(
        request.transcript,
        lat=request.lat,
        lon=request.lon,
        display_name=request.display_name,
        user_id=user_id,
    )
    return VoiceProcessResponse(**result)
