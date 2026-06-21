"""Voice assistant API schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel
from app.core.voice_config import WAKE_WORD

VoiceAction = Literal[
    "open_camera",
    "open_gallery",
    "open_interview",
    "play_music",
    "go_home",
    "take_photo",
    "show_gallery_qr",
    "delete_photo",
] | None


class VoiceProcessRequest(CamelModel):
    transcript: str = Field(..., min_length=1, max_length=2000)
    lat: float | None = None
    lon: float | None = None
    display_name: str | None = None


class VoiceProcessResponse(CamelModel):
    reply: str
    action: VoiceAction = None
    source: str = "router"


class VoiceStatusResponse(CamelModel):
    feature: str = "Voice Assistant"
    available: bool = True
    phase: int = 4
    wake_word: str = WAKE_WORD
    stt: str = "browser"
    tts: str = "browser"
    native_wakeword: bool = False
    native_stt: bool = False
    native_tts: bool = False


class VoiceTtsRequest(CamelModel):
    text: str = Field(..., min_length=1, max_length=4000)
