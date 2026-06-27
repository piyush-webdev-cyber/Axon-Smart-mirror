"""Log CORS preflight and cross-origin API requests for production debugging."""

from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import get_logger

logger = get_logger(__name__)

_DEVICE_PATHS = ("/api/v1/devices/link", "/api/v1/devices/codes")


class CorsLoggingMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {
            k.decode("latin-1").lower(): v.decode("latin-1")
            for k, v in scope.get("headers", [])
        }
        path = scope.get("path", "")
        method = scope.get("method", "")
        origin = headers.get("origin")

        if method == "OPTIONS" or path.endswith("/devices/link") or path.endswith("/devices/codes"):
            logger.info(
                "HTTP %s %s | origin=%s | acrm=%s | acrh=%s",
                method,
                path,
                origin,
                headers.get("access-control-request-method"),
                headers.get("access-control-request-headers"),
            )

        async def send_wrapper(message: Message) -> None:
            if message["type"] == "http.response.start" and (
                path in _DEVICE_PATHS
                or path.endswith("/devices/link")
                or path.endswith("/devices/codes")
            ):
                raw_headers = message.get("headers") or []
                cors = {
                    k.decode("latin-1").lower(): v.decode("latin-1")
                    for k, v in raw_headers
                    if k.decode("latin-1").lower().startswith("access-control")
                }
                logger.info(
                    "HTTP response %s %s | status=%s | cors=%s",
                    method,
                    path,
                    message.get("status"),
                    cors,
                )
            await send(message)

        await self.app(scope, receive, send_wrapper)
