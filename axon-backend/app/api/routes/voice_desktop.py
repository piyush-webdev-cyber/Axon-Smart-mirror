"""Native desktop voice pipeline (WebSocket + TTS HTTP)."""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from app.core.config import settings
from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD
from app.schemas.voice import VoiceTtsRequest
from app.services.stt_service import get_stt_service
from app.services.tts_service import get_tts_service
from app.services.voice_desktop_session import VoiceDesktopSession
from app.services.wakeword_service import get_wakeword_service

logger = get_logger(__name__)

router = APIRouter(prefix="/voice", tags=["voice-desktop"])


def _engine_status_payload() -> dict[str, object]:
    wake = get_wakeword_service(settings.voice_wakeword_model_path or None)
    stt = get_stt_service(settings.voice_whisper_model, settings.voice_whisper_device)
    tts = get_tts_service(settings.voice_piper_bin or None, settings.voice_piper_model or None)
    return {
        "type": "status",
        "wakeWord": WAKE_WORD,
        "wakeword": wake.status().__dict__,
        "stt": stt.status().__dict__,
        "tts": tts.status().__dict__,
        "state": "wake",
    }


@router.websocket("/desktop/ws")
async def voice_desktop_ws(websocket: WebSocket) -> None:
    """Stream PCM16 mono 16 kHz; receive wake/STT events as JSON."""
    await websocket.accept()
    session = VoiceDesktopSession()

    get_wakeword_service(settings.voice_wakeword_model_path or None)
    get_stt_service(settings.voice_whisper_model, settings.voice_whisper_device)
    get_tts_service(settings.voice_piper_bin or None, settings.voice_piper_model or None)

    await websocket.send_json(_engine_status_payload())
    await websocket.send_json({"type": "wake_armed", "wakeWord": WAKE_WORD})

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if bytes_data := message.get("bytes"):
                events = await session.handle_pcm(bytes_data)
                for event in events:
                    await websocket.send_json(event)
                continue

            text_data = message.get("text")
            if not text_data:
                continue

            try:
                payload = json.loads(text_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON control message."})
                continue

            if payload.get("type") != "control":
                continue

            action = str(payload.get("action", ""))
            events = await session.handle_control(action)
            for event in events:
                await websocket.send_json(event)
    except WebSocketDisconnect:
        logger.info("Voice desktop WS disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Voice desktop WS error: %s", exc)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:  # noqa: BLE001
            pass


@router.post("/tts")
async def synthesize_speech(request: VoiceTtsRequest) -> Response:
    """Synthesize speech with Piper; returns audio/wav."""
    tts = get_tts_service(settings.voice_piper_bin or None, settings.voice_piper_model or None)
    if not tts.available:
        return Response(status_code=503, content="TTS engine unavailable")

    wav = tts.synthesize_wav(request.text)
    if not wav:
        return Response(status_code=500, content="TTS synthesis failed")

    return Response(content=wav, media_type="audio/wav")
