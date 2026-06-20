"""Health check endpoint - liveness probe for the mirror + orchestrators."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import settings
from app.schemas.system import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
async def health() -> HealthResponse:
    return HealthResponse(
        service=settings.service_name,
        version=settings.version,
        timestamp=datetime.now(UTC),
    )
