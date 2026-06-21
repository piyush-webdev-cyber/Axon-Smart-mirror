"""Axon backend application entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Interactive docs: http://localhost:8000/docs
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger
from app.middleware.error_handler import register_exception_handlers
from app.websockets.router import ws_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    from app.websockets.voice_handlers import register_voice_handlers

    register_voice_handlers()
    logger.info(
        "Axon backend starting | env=%s | phase=%s | version=%s",
        settings.env,
        settings.phase,
        settings.version,
    )
    yield
    logger.info("Axon backend shutting down.")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Axon API",
        version=settings.version,
        description="Axon AI Smart Mirror backend (Phase 1 foundation).",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # CORS configuration - must allow WebSocket upgrades
    cors_origins = settings.get_cors_origins()
    if settings.debug:
        logger.info("CORS allowed origins: %s", cors_origins)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    register_exception_handlers(app)

    # Root redirect to docs
    @app.get("/")
    async def root():
        return {
            "message": "Axon Smart Mirror API",
            "version": settings.version,
            "docs": "/docs",
            "health": f"{settings.api_prefix}/health",
            "api": settings.api_prefix,
        }

    # REST + WebSocket under the same versioned prefix.
    app.include_router(api_router, prefix=settings.api_prefix)
    app.include_router(ws_router, prefix=settings.api_prefix)

    return app


app = create_app()
