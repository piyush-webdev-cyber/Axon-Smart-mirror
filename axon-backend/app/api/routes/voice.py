"""Voice assistant HTTP routes."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import decode_supabase_jwt
from app.schemas.voice import VoiceProcessRequest, VoiceProcessResponse, VoiceStatusResponse
from app.core.config import settings
from app.services.stt_service import get_stt_service
from app.services.tts_service import get_tts_service
from app.services.voice_pipeline import get_voice_pipeline
from app.services.voice_service import process_voice_command
from app.services.wakeword_service import get_wakeword_service

router = APIRouter(prefix="/voice", tags=["voice"])

_bearer = HTTPBearer(auto_error=False)


def _init_wakeword():
    return get_wakeword_service(
        settings.voice_wakeword_model_path or None,
        porcupine_access_key=settings.voice_porcupine_access_key or None,
        porcupine_keyword_path=settings.voice_porcupine_keyword_path or None,
        engine=settings.voice_wakeword_engine,
    )


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
    wake = _init_wakeword()
    stt = get_stt_service(settings.voice_whisper_model, settings.voice_whisper_device)
    tts = get_tts_service(settings.voice_piper_bin or None, settings.voice_piper_model or None)
    pipeline = get_voice_pipeline()

    native_any = wake.available or stt.available or tts.available
    return VoiceStatusResponse(
        stt="faster-whisper" if stt.available else "browser",
        tts="piper" if tts.available else "browser",
        native_wakeword=wake.available,
        native_stt=stt.available,
        native_tts=tts.available,
        available=True if native_any else True,
        pipeline_running=pipeline.running,
        pipeline_state=pipeline.state.value,
    )


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
