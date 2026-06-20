"""Global exception handling.

Registers handlers that convert every error - expected domain errors, FastAPI
validation errors, and unexpected exceptions - into the consistent envelope
``{"error": {"code", "message", "details"}}``.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.errors import AxonError
from app.core.logging import get_logger

logger = get_logger(__name__)


def _envelope(code: str, message: str, details: Any | None = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AxonError)
    async def _handle_axon_error(_: Request, exc: AxonError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _handle_validation(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_envelope(
                "validation_error",
                "Request validation failed.",
                exc.errors(),
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _handle_http(
        _: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_envelope("http_error", str(exc.detail)),
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content=_envelope("internal_error", "An unexpected error occurred."),
        )
