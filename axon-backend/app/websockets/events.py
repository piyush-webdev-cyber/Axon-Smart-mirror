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
    SYSTEM_ERROR = "system.error"
    PING = "system.ping"
    PONG = "system.pong"
    DEVICE_STATUS = "device.status"

    # Phase 3 events
    DEVICE_LINKED = "device.linked"
    DEVICE_EXPIRED = "device.expired"
    PHOTO_CREATED = "photo.created"
    PHOTO_DELETED = "photo.deleted"
    PHOTO_CAPTURE_STARTED = "photo.capture_started"
    PHOTO_CAPTURE_COMPLETED = "photo.capture_completed"
    PHOTO_UPLOAD_STARTED = "photo.upload_started"
    PHOTO_UPLOAD_COMPLETED = "photo.upload_completed"
    GALLERY_OPENED = "gallery.opened"
    GALLERY_CLOSED = "gallery.closed"

    # Phase 4 — Voice assistant
    VOICE_WAKE_DETECTED = "voice.wake_detected"
    VOICE_WAKE = "voice.wake"
    VOICE_LISTENING = "voice.listening"
    VOICE_TRANSCRIPT = "voice.transcript"
    VOICE_PROCESSING = "voice.processing"
    VOICE_RESPONSE = "voice.response"
    VOICE_SPEAKING = "voice.speaking"
    VOICE_COMPLETE = "voice.complete"
    VOICE_PROCESS = "voice.process"

    # Legacy aliases (kept for backward compatibility)
    VOICE_STATE = "voice.state"

    # Phase 6 — Music
    MUSIC_STARTED = "music.started"
    MUSIC_PAUSED = "music.paused"
    MUSIC_RESUMED = "music.resumed"
    MUSIC_PROGRESS = "music.progress"
    MUSIC_FINISHED = "music.finished"
    MUSIC_QUEUE_UPDATED = "music.queue.updated"
    MUSIC_VOLUME_CHANGED = "music.volume.changed"
    MUSIC_SEARCH_COMPLETED = "music.search.completed"
    MUSIC_STATE = "music.state"

    # Reserved for future phases
    INTERVIEW_MESSAGE = "interview.message"
    FACE_DETECTED = "face.detected"
