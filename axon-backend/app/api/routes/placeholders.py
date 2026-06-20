"""Future-feature placeholder routers.

Every Phase 2+ capability gets a real, documented route now that returns
HTTP 501 via ``NotImplementedYetError``. This locks in the URL surface and keeps
the OpenAPI schema (and generated frontend types) stable across phases.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.errors import NotImplementedYetError
from app.schemas.common import CamelModel


class FeatureStatus(CamelModel):
    feature: str
    available: bool
    phase: int


def _make_placeholder(prefix: str, tag: str, feature: str, phase: int) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    @router.get(
        "/status",
        response_model=FeatureStatus,
        summary=f"{feature} availability",
    )
    async def status() -> FeatureStatus:
        return FeatureStatus(feature=feature, available=False, phase=phase)

    @router.post("", summary=f"{feature} (not implemented in Phase 1)")
    async def not_implemented() -> None:
        raise NotImplementedYetError(feature)

    return router


voice_router = _make_placeholder("/voice", "voice", "Voice Assistant", phase=3)
photos_router = _make_placeholder("/photos", "photos", "Photos", phase=4)
interviews_router = _make_placeholder(
    "/interviews", "interviews", "InterviewGPT", phase=5
)
face_router = _make_placeholder("/face", "face", "Face Recognition", phase=4)
music_router = _make_placeholder("/music", "music", "Music Playback", phase=6)

placeholder_routers = [
    voice_router,
    photos_router,
    interviews_router,
    face_router,
    music_router,
]
