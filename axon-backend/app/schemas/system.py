"""Health and system schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from app.schemas.common import CamelModel


class HealthResponse(CamelModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    timestamp: datetime


class SystemInfo(CamelModel):
    service: str
    version: str
    environment: str
    phase: int


class SystemStatus(CamelModel):
    uptime_seconds: float
    online: bool
    connections: int
