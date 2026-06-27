"""WebSocket endpoint.

Mounted at ``{API_PREFIX}/ws``. Accepts connections, optionally identifies the
user via a ``token`` query param (Supabase access token), and pumps inbound
messages through the connection manager's handler registry.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings
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


def _request_headers(websocket: WebSocket) -> dict[str, str]:
    return {
        key.decode("latin-1").lower(): value.decode("latin-1")
        for key, value in websocket.scope.get("headers", [])
    }


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
            exc_info=True,
        )


async def _close_ws(
    websocket: WebSocket,
    *,
    code: int = 1011,
    reason: str = "",
) -> None:
    try:
        await websocket.close(code=code, reason=reason[:120])
        logger.info(
            "WS closed explicitly | client=%s | code=%s | reason=%s",
            _client_label(websocket),
            code,
            reason[:120],
        )
    except Exception as close_exc:  # noqa: BLE001
        logger.debug(
            "WS close already completed for %s: %s",
            _client_label(websocket),
            close_exc,
        )


@ws_router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None) -> None:
    """Main mirror WebSocket — anonymous connections allowed in Phase 1."""
    client = _client_label(websocket)
    headers = _request_headers(websocket)
    user_id: str | None = None
    connected = False

    logger.info("WS CONNECT | client=%s | path=%s | origin=%s", client, websocket.url.path, headers.get("origin"))

    try:
        user_id = _resolve_user_id(token)

        allowed_origins = settings.get_cors_origins()
        origin = headers.get("origin")
        if origin and origin not in allowed_origins:
            logger.warning(
                "WS origin not in CORS allowlist (continuing anyway) | origin=%s | allowed=%s",
                origin,
                allowed_origins,
            )

        logger.info("WS calling accept() | client=%s", client)
        await connection_manager.connect(websocket, user_id)
        connected = True
        logger.info(
            "WS CONNECT accepted | client=%s | user_id=%s | total=%d",
            client,
            user_id,
            connection_manager.connection_count,
        )

        await connection_manager.send(
            websocket, WsEvent.SYSTEM_CONNECTED, {"status": "connected"}
        )
        logger.info("WS sent system.connected | client=%s", client)

        while True:
            raw = await websocket.receive()

            if raw["type"] == "websocket.disconnect":
                disconnect_code = raw.get("code", 1000)
                disconnect_reason = raw.get("reason") or ""
                if isinstance(disconnect_reason, bytes):
                    disconnect_reason = disconnect_reason.decode("utf-8", errors="replace")
                logger.info(
                    "WS DISCONNECT | client=%s | user_id=%s | code=%s | reason=%s",
                    client,
                    user_id,
                    disconnect_code,
                    disconnect_reason,
                )
                break

            if raw["type"] != "websocket.receive":
                logger.debug(
                    "WS ignored frame | client=%s | type=%s",
                    client,
                    raw["type"],
                )
                continue

            text = raw.get("text")
            if text is None:
                logger.debug("WS binary frame ignored | client=%s", client)
                continue

            try:
                message = json.loads(text)
            except json.JSONDecodeError as exc:
                logger.warning(
                    "WS invalid JSON | client=%s | error=%s | text=%s",
                    client,
                    exc,
                    text[:200],
                )
                await _send_ws_error(websocket, "Invalid JSON message.")
                continue

            msg_type = message.get("type") if isinstance(message, dict) else type(message).__name__
            if msg_type in ("system.ping", "system.pong"):
                logger.info("WS %s | client=%s", msg_type.upper().replace(".", " "), client)
            else:
                logger.info("WS MESSAGE | client=%s | type=%s", client, msg_type)
            await connection_manager.dispatch(websocket, message)

    except WebSocketDisconnect as exc:
        logger.info(
            "WS DISCONNECT | client=%s | user_id=%s | code=%s | reason=%s",
            client,
            user_id,
            getattr(exc, "code", None),
            getattr(exc, "reason", None),
        )
    except Exception as exc:
        logger.exception(
            "WS ERROR | client=%s | user_id=%s | connected=%s | error=%s",
            client,
            user_id,
            connected,
            exc,
        )
        if connected:
            await _send_ws_error(websocket, str(exc))
            await _close_ws(websocket, code=1011, reason=str(exc))
    finally:
        if connected:
            connection_manager.disconnect(websocket, user_id)
            logger.info(
                "WS cleanup complete | client=%s | user_id=%s | remaining=%d",
                client,
                user_id,
                connection_manager.connection_count,
            )
