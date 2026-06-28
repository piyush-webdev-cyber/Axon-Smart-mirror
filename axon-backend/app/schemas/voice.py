"""Voice assistant API schemas."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel
from app.core.voice_config import WAKE_WORD

VoiceAction = Literal[
    "open_camera",
    "close_camera",
    "open_gallery",
    "open_interview",
    "open_music",
    "close_music",
    "play_music",
    "pause_music",
    "resume_music",
    "stop_music",
    "next_track",
    "previous_track",
    "volume_up",
    "volume_down",
    "mute_music",
    "unmute_music",
    "shuffle_music",
    "repeat_music",
    "go_home",
    "open_settings",
    "open_weather",
    "refresh_weather",
    "take_photo",
    "show_gallery_qr",
    "delete_photo",
    "logout",
] | None


class VoiceProcessRequest(CamelModel):
    transcript: str = Field(..., min_length=1, max_length=2000)
    lat: float | None = None
    lon: float | None = None
    display_name: str | None = None


class VoiceProcessResponse(CamelModel):
    reply: str
    action: VoiceAction = None
    music_query: str | None = None
    source: str = "router"


class VoiceStatusResponse(CamelModel):
    feature: str = "Voice Assistant"
    available: bool = True
    phase: int = 6
    wake_word: str = WAKE_WORD
    stt: str = "browser"
    tts: str = "browser"
    native_wakeword: bool = False
    native_stt: bool = False
    native_tts: bool = False
    pipeline_running: bool = False
    pipeline_state: str = "stopped"


class VoicePipelineStatusResponse(CamelModel):
    running: bool = False
    state: str = "stopped"
    wake_word: str = WAKE_WORD
    wakeword: dict[str, object] | None = None
    stt: dict[str, object] | None = None
    tts: dict[str, object] | None = None


class VoiceTtsRequest(CamelModel):
    text: str = Field(..., min_length=1, max_length=4000)
