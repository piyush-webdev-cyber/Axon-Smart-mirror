"""Structured logging helpers for Phase 6 observability."""

from __future__ import annotations

import json
from typing import Any

from app.core.logging import get_logger

_log = get_logger("axon.structured")


def log_event(domain: str, event: str, **fields: Any) -> None:
    """Emit a single-line JSON log entry for dashboards and grep."""
    payload = {"domain": domain, "event": event, **fields}
    try:
        line = json.dumps(payload, default=str)
    except TypeError:
        line = str(payload)
    _log.info(line)


def log_voice_intent(*, transcript: str, action: str | None, source: str) -> None:
    log_event("voice", "intent", transcript=transcript[:120], action=action, source=source)


def log_ws(*, event: str, client: str, **extra: Any) -> None:
    log_event("websocket", event, client=client, **extra)


def log_device_link(*, event: str, code: str | None = None, **extra: Any) -> None:
    log_event("device_link", event, code=code, **extra)


def log_music(*, event: str, user_id: str | None = None, **extra: Any) -> None:
    log_event("music", event, user_id=user_id, **extra)


def log_camera(*, event: str, **extra: Any) -> None:
    log_event("camera", event, **extra)


def log_gallery(*, event: str, **extra: Any) -> None:
    log_event("gallery", event, **extra)


def log_weather(*, event: str, **extra: Any) -> None:
    log_event("weather", event, **extra)


def log_error(domain: str, message: str, **extra: Any) -> None:
    log_event(domain, "error", message=message, **extra)
