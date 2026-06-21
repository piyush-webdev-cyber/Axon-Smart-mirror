"""Voice WebSocket handlers."""

from __future__ import annotations

from fastapi import WebSocket

from app.core.logging import get_logger
from app.services.voice_service import process_voice_command
from app.websockets.events import WsEvent
from app.websockets.manager import connection_manager

logger = get_logger(__name__)


async def _on_voice_process(websocket: WebSocket, payload: dict) -> None:
    transcript = str(payload.get("transcript") or "").strip()
    if not transcript:
        return

    await connection_manager.send(websocket, WsEvent.VOICE_PROCESSING, {"transcript": transcript})

    result = await process_voice_command(
        transcript,
        lat=payload.get("lat"),
        lon=payload.get("lon"),
        display_name=payload.get("display_name"),
        user_id=payload.get("user_id"),
    )

    await connection_manager.send(websocket, WsEvent.VOICE_RESPONSE, result)
    await connection_manager.send(websocket, WsEvent.VOICE_COMPLETE, {})


async def _relay_client_event(websocket: WebSocket, event: WsEvent, payload: dict) -> None:
    """Echo client-side voice lifecycle events back to the same connection."""
    await connection_manager.send(websocket, event, payload)


def register_voice_handlers() -> None:
    """Attach voice handlers to the shared connection manager."""
    connection_manager.register_handler(WsEvent.VOICE_PROCESS, _on_voice_process)

    async def _relay_wake_detected(ws: WebSocket, payload: dict) -> None:
        await _relay_client_event(ws, WsEvent.VOICE_WAKE_DETECTED, payload)

    async def _relay_wake(ws: WebSocket, payload: dict) -> None:
        await _relay_client_event(ws, WsEvent.VOICE_WAKE, payload)

    async def _relay_listening(ws: WebSocket, payload: dict) -> None:
        await _relay_client_event(ws, WsEvent.VOICE_LISTENING, payload)

    async def _relay_transcript(ws: WebSocket, payload: dict) -> None:
        await _relay_client_event(ws, WsEvent.VOICE_TRANSCRIPT, payload)

    async def _relay_speaking(ws: WebSocket, payload: dict) -> None:
        await _relay_client_event(ws, WsEvent.VOICE_SPEAKING, payload)

    connection_manager.register_handler(WsEvent.VOICE_WAKE_DETECTED, _relay_wake_detected)
    connection_manager.register_handler(WsEvent.VOICE_WAKE, _relay_wake)
    connection_manager.register_handler(WsEvent.VOICE_LISTENING, _relay_listening)
    connection_manager.register_handler(WsEvent.VOICE_TRANSCRIPT, _relay_transcript)
    connection_manager.register_handler(WsEvent.VOICE_SPEAKING, _relay_speaking)

    logger.info("Voice WebSocket handlers registered")
