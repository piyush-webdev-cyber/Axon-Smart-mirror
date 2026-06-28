"""Aggregates all v1 HTTP routers into a single APIRouter."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import (
    auth,
    devices,
    gallery,
    health,
    music,
    photos,
    system,
    users,
    voice,
    voice_desktop,
    weather,
)
from app.api.routes.placeholders import placeholder_routers

api_router = APIRouter()

# Active Phase 1 routers
api_router.include_router(health.router)
api_router.include_router(system.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)

# Phase 3 routers
api_router.include_router(devices.router)
api_router.include_router(photos.router)
api_router.include_router(gallery.router)
api_router.include_router(weather.router)
api_router.include_router(voice.router)
api_router.include_router(voice_desktop.router)

# Phase 6 — Music
api_router.include_router(music.router)

# Reserved future-feature placeholders (HTTP 501)
for router in placeholder_routers:
    api_router.include_router(router)
