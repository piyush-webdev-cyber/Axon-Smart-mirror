"""System telemetry service."""

from __future__ import annotations

import time

from app.core.config import settings
from app.schemas.system import SystemInfo, SystemStatus
from app.websockets.manager import connection_manager

_BOOT_TIME = time.monotonic()


def get_system_info() -> SystemInfo:
    return SystemInfo(
        service=settings.service_name,
        version=settings.version,
        environment=settings.env,
        phase=settings.phase,
    )


def get_system_status() -> SystemStatus:
    return SystemStatus(
        uptime_seconds=round(time.monotonic() - _BOOT_TIME, 2),
        online=True,
        connections=connection_manager.connection_count,
    )
