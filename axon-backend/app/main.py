"""Axon backend application entrypoint.

Run locally:
    uvicorn app.main:app --reload --port 8000

Interactive docs: http://localhost:8000/docs
"""

from __future__ import annotations

import asyncio
import threading
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


def _preload_voice_engines() -> None:
    """Warm wake-word + STT models so the first command is not delayed."""
    try:
        from app.api.routes.voice import _init_wakeword
        from app.services.stt_service import get_stt_service

        wake = _init_wakeword()
        stt = get_stt_service(settings.voice_whisper_model, settings.voice_whisper_device)
        logger.info("[VOICE] Service Started")
        logger.info(
            "[VOICE] Engines preloaded | wakeword=%s | stt=%s",
            wake.available,
            stt.available,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("[VOICE] Engine preload skipped: %s", exc)


async def _bootstrap_hands_free_voice() -> None:
    """Load ML models then start pipeline + OS microphone without waiting for Electron WS."""
    if settings.is_production:
        logger.info(
            "[VOICE] Skipping desktop voice bootstrap in production "
            "(Railway has no local mic; mirror uses Electron for voice)."
        )
        return
    await asyncio.to_thread(_preload_voice_engines)
    if not settings.voice_local_mic:
        return
    try:
        from app.api.routes.voice_desktop import bootstrap_desktop_voice

        await bootstrap_desktop_voice()
    except Exception as exc:  # noqa: BLE001
        logger.exception("[VOICE] Hands-free bootstrap failed: %s", exc)


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
    await _bootstrap_hands_free_voice()
    yield
    logger.info("Axon backend shutting down.")
    if settings.voice_local_mic:
        from app.services.local_mic_service import get_local_mic_service
        from app.services.voice_pipeline import get_voice_pipeline

        get_local_mic_service().stop()
        pipeline = get_voice_pipeline()
        if pipeline.running:
            await pipeline.stop()


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
