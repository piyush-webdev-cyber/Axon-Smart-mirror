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


def _client_label(websocket: WebSocket) -> str:
    client = websocket.client
    if client is None:
        return "unknown"
    return f"{client.host}:{client.port}"


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


async def _send_ws_error(websocket: WebSocket, message: str) -> None:
    try:
        await connection_manager.send(
            websocket,
            WsEvent.SYSTEM_ERROR,
            {"message": message},
        )
    except Exception as send_exc:  # noqa: BLE001
        logger.warning(
            "WS failed to send error frame to %s: %s",
            _client_label(websocket),
            send_exc,
        )


@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None) -> None:
    client = _client_label(websocket)
    logger.info(
        "WS connect attempt | client=%s | has_token=%s | path=%s",
        client,
        bool(token),
        websocket.url.path,
    )

    user_id: str | None = None
    connected = False

    try:
        user_id = _resolve_user_id(token)
        await connection_manager.connect(websocket, user_id)
        connected = True
        logger.info(
            "WS accepted | client=%s | user_id=%s | total=%d",
            client,
            user_id,
            connection_manager.connection_count,
        )

        await connection_manager.send(
            websocket, WsEvent.SYSTEM_CONNECTED, {"status": "connected"}
        )
        logger.info("WS sent system.connected | client=%s", client)

        while True:
            message = await websocket.receive_json()
            logger.info(
                "WS message | client=%s | type=%s",
                client,
                message.get("type") if isinstance(message, dict) else type(message).__name__,
            )
            await connection_manager.dispatch(websocket, message)

    except WebSocketDisconnect as exc:
        logger.info(
            "WS disconnect | client=%s | user_id=%s | code=%s | reason=%s",
            client,
            user_id,
            getattr(exc, "code", None),
            getattr(exc, "reason", None),
        )
    except Exception as exc:
        logger.exception(
            "WS unhandled error | client=%s | user_id=%s | error=%s",
            client,
            user_id,
            exc,
        )
        if connected:
            await _send_ws_error(websocket, str(exc))
    finally:
        if connected:
            connection_manager.disconnect(websocket, user_id)
            logger.info(
                "WS cleanup complete | client=%s | user_id=%s | remaining=%d",
                client,
                user_id,
                connection_manager.connection_count,
            )
