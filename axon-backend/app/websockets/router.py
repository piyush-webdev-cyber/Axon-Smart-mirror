"""WebSocket endpoint.

Mounted at ``{API_PREFIX}/ws``. Accepts connections, optionally identifies the
user via a ``token`` query param (Supabase access token), and pumps inbound
messages through the connection manager's handler registry.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger
from app.core.security import decode_supabase_jwt
from app.websockets.events import WsEvent
from app.websockets.manager import connection_manager

logger = get_logger(__name__)

ws_router = APIRouter()


def _resolve_user_id(token: str | None) -> str | None:
    if not token:
        logger.info("WS auth skipped: anonymous connection")
        return None
    try:
        user_id = decode_supabase_jwt(token).id
        logger.info("WS auth resolved: user_id=%s", user_id)
        return user_id
    except Exception as exc:  # noqa: BLE001 - anonymous connection is allowed in Phase 1
        logger.warning("WS auth failed; continuing anonymously: %s", exc)
        return None


@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None) -> None:
    logger.info("WS connection attempt from %s", websocket.client)
    user_id: str | None = None
    try:
        user_id = _resolve_user_id(token)
        await connection_manager.connect(websocket, user_id)
        logger.info("WS accepted from %s", websocket.client)
        await connection_manager.send(
            websocket, WsEvent.SYSTEM_CONNECTED, {"status": "connected"}
        )
        while True:
            message = await websocket.receive_json()
            logger.info(
                "WS message received from %s: type=%s",
                websocket.client,
                message.get("type"),
            )
            await connection_manager.dispatch(websocket, message)
    except WebSocketDisconnect:
        logger.info("WS client disconnected: %s", websocket.client)
        connection_manager.disconnect(websocket, user_id)
    except Exception as exc:  # noqa: BLE001
        logger.exception("WS error for %s: %s", websocket.client, exc)
        connection_manager.disconnect(websocket, user_id)
