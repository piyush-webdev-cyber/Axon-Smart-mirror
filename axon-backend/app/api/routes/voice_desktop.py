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
from app.services.local_mic_service import get_local_mic_service
from app.services.stt_service import get_stt_service
from app.services.tts_service import get_tts_service
from app.services.voice_pipeline import get_voice_pipeline
from app.services.wakeword_service import effective_listen_phrase, get_wakeword_service

logger = get_logger(__name__)

router = APIRouter(prefix="/voice", tags=["voice-desktop"])

_event_clients: set[WebSocket] = set()


def _start_local_mic() -> bool:
    if not settings.voice_local_mic:
        logger.info("[VOICE] Local mic disabled (AXON_VOICE_LOCAL_MIC=false)")
        return False
    mic = get_local_mic_service()
    if not mic.available:
        logger.warning("[VOICE] Local mic disabled — sounddevice not installed")
        return False
    if mic.running:
        logger.info("[VOICE] Local mic already active (bytes_sent=%d)", mic.bytes_sent)
        return True
    import asyncio

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        logger.error("[VOICE] Cannot start local mic — no running asyncio event loop")
        return False
    ok = mic.start(loop)
    logger.info("[VOICE] _start_local_mic() -> %s", ok)
    return ok


async def bootstrap_desktop_voice() -> dict[str, object]:
    """Start pipeline + backend microphone at server boot (hands-free, no frontend click)."""
    _init_engines()
    wake = get_wakeword_service()
    wake.log_engine_status()

    pipeline = get_voice_pipeline()
    if not pipeline.running:
        await pipeline.start()
    else:
        logger.info("[VOICE] Pipeline already running (state=%s)", pipeline.state.value)

    mic_ok = _start_local_mic()
    logger.info(
        "[VOICE] Bootstrap complete | pipeline=%s | local_mic=%s | bytes_sent=%d",
        pipeline.state.value,
        mic_ok,
        get_local_mic_service().bytes_sent,
    )
    return {"pipeline": pipeline.state.value, "localMic": mic_ok}


def _init_engines() -> None:
    get_wakeword_service(
        settings.voice_wakeword_model_path or None,
        threshold=settings.voice_wakeword_threshold,
        porcupine_access_key=settings.voice_porcupine_access_key or None,
        porcupine_keyword_path=settings.voice_porcupine_keyword_path or None,
        engine=settings.voice_wakeword_engine,
    )
    get_stt_service(settings.voice_whisper_model, settings.voice_whisper_device)
    get_tts_service(settings.voice_piper_bin or None, settings.voice_piper_model or None)


def _engine_status_payload() -> dict[str, object]:
    pipeline = get_voice_pipeline()
    wake = get_wakeword_service()
    payload = pipeline.status_payload()
    payload["type"] = "status"
    payload["listenPhrase"] = effective_listen_phrase(
        settings.voice_wakeword_model_path or None,
    )
    payload["wakewordAvailable"] = wake.available
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



@router.get("/debug")
async def voice_debug() -> dict[str, object]:
    """Wake-word engine diagnostics (scores, model keys, threshold)."""
    from app.services.wakeword_service import get_wakeword_debug_info

    return get_wakeword_debug_info()


@router.post("/start")
async def voice_pipeline_start() -> dict[str, object]:
    result = await bootstrap_desktop_voice()
    pipeline = get_voice_pipeline()
    event = {"type": "status", "state": pipeline.state.value}
    await _broadcast_events([event])
    return {"ok": True, "state": pipeline.state.value, "event": event, **result}


@router.post("/stop")
async def voice_pipeline_stop() -> dict[str, object]:
    pipeline = get_voice_pipeline()
    if settings.voice_local_mic:
        get_local_mic_service().stop()
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

    mic_ok = _start_local_mic()
    status = _engine_status_payload()
    status["localMicActive"] = mic_ok
    await websocket.send_json(status)
    if mic_ok:
        await websocket.send_json({"type": "audio_streaming", "source": "local_mic"})
    else:
        await websocket.send_json(
            {"type": "audio_blocked", "message": "Backend microphone unavailable"},
        )

    await websocket.send_json(
        {
            "type": "listening_resumed",
            "wakeWord": WAKE_WORD,
            "listenPhrase": effective_listen_phrase(settings.voice_wakeword_model_path or None),
        },
    )
    await websocket.send_json(
        {
            "type": "wake_armed",
            "wakeWord": WAKE_WORD,
            "listenPhrase": effective_listen_phrase(settings.voice_wakeword_model_path or None),
        },
    )

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
                if not get_local_mic_service().running:
                    events = await pipeline.handle_pcm(bytes_data)
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
        # Keep backend mic running for hands-free wake word across WS reconnects.


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
