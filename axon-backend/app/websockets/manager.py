"""WebSocket connection manager.

A single, scalable hub that tracks active connections and provides the core
primitives every future real-time feature needs: per-connection send, broadcast,
and send-to-user. Handlers are registered against typed events so adding a
feature never touches this transport layer.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from fastapi import WebSocket

from app.core.logging import get_logger
from app.websockets.events import WsEvent

logger = get_logger(__name__)

WsHandler = Callable[["WebSocket", dict], Awaitable[None]]


def make_message(event: str, payload: dict | None = None) -> dict:
    """Build the canonical envelope shared with the frontend."""
    return {
        "type": event,
        "payload": payload or {},
        "timestamp": datetime.now(UTC).isoformat(),
    }


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        # user_id -> set of that user's sockets (multi-device support)
        self._by_user: dict[str, set[WebSocket]] = {}
        self._handlers: dict[str, WsHandler] = {}
        self._register_default_handlers()

    @property
    def connection_count(self) -> int:
        return len(self._connections)

    async def connect(self, websocket: WebSocket, user_id: str | None = None) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        if user_id:
            self._by_user.setdefault(user_id, set()).add(websocket)
        logger.info("WS connected (total=%d)", self.connection_count)

    def disconnect(self, websocket: WebSocket, user_id: str | None = None) -> None:
        self._connections.discard(websocket)
        if user_id and user_id in self._by_user:
            self._by_user[user_id].discard(websocket)
            if not self._by_user[user_id]:
                del self._by_user[user_id]
        logger.info("WS disconnected (total=%d)", self.connection_count)

    async def send(
        self, websocket: WebSocket, event: str, payload: dict | None = None
    ) -> None:
        await websocket.send_json(make_message(event, payload))

    async def broadcast(self, event: str, payload: dict | None = None) -> None:
        message = make_message(event, payload)
        for connection in list(self._connections):
            try:
                await connection.send_json(message)
            except Exception:  # noqa: BLE001 - drop dead sockets, keep broadcasting
                self._connections.discard(connection)

    async def send_to_user(
        self, user_id: str, event: str, payload: dict | None = None
    ) -> None:
        message = make_message(event, payload)
        for connection in list(self._by_user.get(user_id, set())):
            try:
                await connection.send_json(message)
            except Exception:  # noqa: BLE001
                self.disconnect(connection, user_id)

    def register_handler(self, event: str, handler: WsHandler) -> None:
        """Attach a handler for an inbound event type."""
        self._handlers[event] = handler

    async def dispatch(self, websocket: WebSocket, message: dict) -> None:
        """Route an inbound message to its registered handler, if any."""
        event = message.get("type")
        handler = self._handlers.get(event) if event else None
        if handler is None:
            return
        await handler(websocket, message.get("payload", {}))

    def _register_default_handlers(self) -> None:
        async def _on_ping(websocket: WebSocket, _payload: dict) -> None:
            await self.send(websocket, WsEvent.PONG)

        self.register_handler(WsEvent.PING, _on_ping)

        # Reserved event handlers are intentionally absent in Phase 1; future
        # features call `register_handler(WsEvent.VOICE_STATE, ...)` etc.


connection_manager = ConnectionManager()
