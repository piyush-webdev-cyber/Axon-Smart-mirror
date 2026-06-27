"""ASGI middleware — log WebSocket upgrade attempts before routing."""

from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import get_logger

logger = get_logger(__name__)


def _header_map(scope: Scope) -> dict[str, str]:
    raw = scope.get("headers") or []
    return {
        key.decode("latin-1").lower(): value.decode("latin-1")
        for key, value in raw
    }


class WebSocketLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "websocket":
            await self.app(scope, receive, send)
            return

        headers = _header_map(scope)
        logger.info(
            "WS upgrade request | path=%s | origin=%s | host=%s | "
            "x-forwarded-proto=%s | x-forwarded-for=%s | sec-websocket-key=%s",
            scope.get("path"),
            headers.get("origin"),
            headers.get("host"),
            headers.get("x-forwarded-proto"),
            headers.get("x-forwarded-for"),
            headers.get("sec-websocket-key"),
        )

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "websocket.accept":
                logger.info(
                    "WS HTTP 101 Switching Protocols | path=%s | subprotocol=%s",
                    scope.get("path"),
                    message.get("subprotocol"),
                )
            elif message["type"] == "websocket.close":
                logger.info(
                    "WS close frame sent | path=%s | code=%s | reason=%s",
                    scope.get("path"),
                    message.get("code"),
                    message.get("reason"),
                )
            await send(message)

        await self.app(scope, receive, send_wrapper)
