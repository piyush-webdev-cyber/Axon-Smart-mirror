"""Canonical WebSocket event-type registry.

Mirrors the frontend `wsEvents.ts`. Phase 1 only handles connection/system
events; the rest are reserved so future real-time features attach handlers
without changing the transport.
"""

from __future__ import annotations

from enum import StrEnum


class WsEvent(StrEnum):
    # Active in Phase 1
    SYSTEM_CONNECTED = "system.connected"
    PING = "system.ping"
    PONG = "system.pong"
    DEVICE_STATUS = "device.status"

    # Reserved for future phases
    VOICE_STATE = "voice.state"
    VOICE_TRANSCRIPT = "voice.transcript"
    INTERVIEW_MESSAGE = "interview.message"
    FACE_DETECTED = "face.detected"
    MUSIC_STATE = "music.state"
