"""Application logging configuration.

Kept intentionally simple for Phase 1. Structured/JSON logging and remote
log shipping can be layered on in later phases without changing call sites.
"""

from __future__ import annotations

import logging

from app.core.config import settings

_CONFIGURED = False


def configure_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return

    level = logging.DEBUG if settings.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    if not settings.debug:
        for name in ("httpcore", "httpx", "hpack", "hpack.hpack", "hpack.table", "urllib3"):
            logging.getLogger(name).setLevel(logging.WARNING)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
