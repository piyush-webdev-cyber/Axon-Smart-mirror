"""Native desktop voice pipeline (WebSocket + TTS HTTP + lifecycle control)."""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import Response

from app.core.config import settings
from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD
from app.schemas.voice import VoiceTtsRequest
from app.services.stt_service import get_stt_service
from app.services.tts_service import get_tts_service
from app.services.voice_pipeline import get_voice_pipeline
from app.services.wakeword_service import get_wakeword_service

logger = get_logger(__name__)

router = APIRouter(prefix="/voice", tags=["voice-desktop"])

_event_clients: set[WebSocket] = set()


def _init_engines() -> None:
    get_wakeword_service(
        settings.voice_wakeword_model_path or None,
        porcupine_access_key=settings.voice_porcupine_access_key or None,
        porcupine_keyword_path=settings.voice_porcupine_keyword_path or None,
        engine=settings.voice_wakeword_engine,
    )
    get_stt_service(settings.voice_whisper_model, settings.voice_whisper_device)
    get_tts_service(settings.voice_piper_bin or None, settings.voice_piper_model or None)


def _engine_status_payload() -> dict[str, object]:
    pipeline = get_voice_pipeline()
    payload = pipeline.status_payload()
    payload["type"] = "status"
    return payload


async def _broadcast_events(events: list[dict[str, object]]) -> None:
    dead: list[WebSocket] = []
    for ws in list(_event_clients):
        for event in events:
            try:
                await ws.send_json(event)
            except Exception:  # noqa: BLE001
                dead.append(ws)
                break
    for ws in dead:
        _event_clients.discard(ws)



@router.post("/start")
async def voice_pipeline_start() -> dict[str, object]:
    _init_engines()
    pipeline = get_voice_pipeline()
    event = await pipeline.start()
    await _broadcast_events([event])
    return {"ok": True, "state": pipeline.state.value, "event": event}


@router.post("/stop")
async def voice_pipeline_stop() -> dict[str, object]:
    pipeline = get_voice_pipeline()
    event = await pipeline.stop()
    await _broadcast_events([event])
    return {"ok": True, "state": pipeline.state.value, "event": event}


@router.websocket("/events")
async def voice_events_ws(websocket: WebSocket) -> None:
    """Subscribe to voice pipeline lifecycle events (no PCM)."""
    await websocket.accept()
    _init_engines()
    _event_clients.add(websocket)

    pipeline = get_voice_pipeline()
    if not pipeline.running:
        await pipeline.start()

    await websocket.send_json(_engine_status_payload())
    await websocket.send_json({"type": "listening_resumed", "wakeWord": WAKE_WORD})

    async def forward(events: list[dict[str, object]]) -> None:
        for event in events:
            try:
                await websocket.send_json(event)
            except Exception:  # noqa: BLE001
                break

    pipeline.subscribe(forward)
    try:
        while True:
            message = await websocket.receive_text()
            try:
                payload = json.loads(message)
            except json.JSONDecodeError:
                continue
            if payload.get("type") != "control":
                continue
            action = str(payload.get("action", ""))
            events = await pipeline.handle_control(action)
            for event in events:
                await websocket.send_json(event)
    except WebSocketDisconnect:
        logger.info("Voice events WS disconnected")
    finally:
        pipeline.unsubscribe(forward)
        _event_clients.discard(websocket)


@router.websocket("/desktop/ws")
async def voice_desktop_ws(websocket: WebSocket) -> None:
    """Stream PCM16 mono 16 kHz; receive wake/STT/TTS events as JSON."""
    await websocket.accept()
    _init_engines()
    pipeline = get_voice_pipeline()

    if not pipeline.running:
        await pipeline.start()

    await websocket.send_json(_engine_status_payload())
    await websocket.send_json({"type": "listening_resumed", "wakeWord": WAKE_WORD})
    await websocket.send_json({"type": "wake_armed", "wakeWord": WAKE_WORD})

    pending_tts: list[str] = []

    async def forward(events: list[dict[str, object]]) -> None:
        for event in events:
            try:
                await websocket.send_json(event)
            except Exception:  # noqa: BLE001
                break

    pipeline.subscribe(forward)

    try:
        while True:
            message = await websocket.receive()

            if message.get("type") == "websocket.disconnect":
                break

            if bytes_data := message.get("bytes"):
                events = await pipeline.handle_pcm(bytes_data)
                for event in events:
                    await websocket.send_json(event)
                    if event.get("type") == "tts_text" and isinstance(event.get("text"), str):
                        pending_tts.append(str(event["text"]))
                for text in pending_tts:
                    wav = await pipeline.synthesize(text)
                    if wav:
                        await websocket.send_bytes(wav)
                pending_tts.clear()
                continue

            text_data = message.get("text")
            if not text_data:
                continue

            try:
                payload = json.loads(text_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON control message."})
                continue

            if payload.get("type") == "tts_request" and isinstance(payload.get("text"), str):
                wav = await pipeline.synthesize(str(payload["text"]))
                if wav:
                    await websocket.send_bytes(wav)
                continue

            if payload.get("type") != "control":
                continue

            action = str(payload.get("action", ""))
            events = await pipeline.handle_control(action)
            for event in events:
                await websocket.send_json(event)
                if event.get("type") == "tts_text" and isinstance(event.get("text"), str):
                    wav = await pipeline.synthesize(str(event["text"]))
                    if wav:
                        await websocket.send_bytes(wav)
    except WebSocketDisconnect:
        logger.info("Voice desktop WS disconnected")
    except Exception as exc:  # noqa: BLE001
        logger.exception("Voice desktop WS error: %s", exc)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:  # noqa: BLE001
            pass
    finally:
        pipeline.unsubscribe(forward)


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
