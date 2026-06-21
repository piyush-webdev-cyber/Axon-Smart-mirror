"""Desktop voice WebSocket session state machine."""

from __future__ import annotations

import time

import numpy as np

from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD
from app.services.stt_service import SAMPLE_RATE, get_stt_service
from app.services.wakeword_service import get_wakeword_service

logger = get_logger(__name__)

SILENCE_MS = 1200
MAX_COMMAND_MS = 8000


class VoiceDesktopMode:
    WAKE = "wake"
    COMMAND = "command"
    PAUSED = "paused"


class VoiceDesktopSession:
    """Processes streaming PCM from Electron / native clients."""

    def __init__(self) -> None:
        self.mode = VoiceDesktopMode.WAKE
        self._command_buffer = bytearray()
        self._command_started_at: float | None = None
        self._last_voice_at: float | None = None

    async def handle_control(self, action: str) -> list[dict[str, object]]:
        if action == "pause_wake":
            self.mode = VoiceDesktopMode.PAUSED
            self._reset_command()
            return [{"type": "status", "state": self.mode}]
        if action == "resume_wake":
            self.mode = VoiceDesktopMode.WAKE
            get_wakeword_service().reset()
            return [{"type": "wake_armed", "wakeWord": WAKE_WORD}]
        if action == "start_stt":
            self.mode = VoiceDesktopMode.COMMAND
            self._reset_command()
            return [{"type": "status", "state": self.mode}]
        if action == "stop_stt":
            return await self._finalize_command(force=True)
        if action == "reset":
            self.mode = VoiceDesktopMode.WAKE
            get_wakeword_service().reset()
            self._reset_command()
            return [{"type": "wake_armed", "wakeWord": WAKE_WORD}]
        return [{"type": "error", "message": f"Unknown control action: {action}"}]

    async def handle_pcm(self, chunk: bytes) -> list[dict[str, object]]:
        events: list[dict[str, object]] = []

        if self.mode == VoiceDesktopMode.PAUSED or not chunk:
            return events

        if self.mode == VoiceDesktopMode.WAKE:
            if get_wakeword_service().process_pcm16(chunk):
                self.mode = VoiceDesktopMode.COMMAND
                self._reset_command()
                self._command_buffer.extend(chunk)
                self._command_started_at = time.monotonic()
                self._last_voice_at = self._command_started_at
                events.append({"type": "wake_detected", "wakeWord": WAKE_WORD})
            return events

        self._command_buffer.extend(chunk)
        now = time.monotonic()
        if self._command_started_at is None:
            self._command_started_at = now

        if _has_voice_energy(chunk):
            self._last_voice_at = now

        elapsed_ms = (now - self._command_started_at) * 1000
        if elapsed_ms >= MAX_COMMAND_MS:
            events.extend(await self._finalize_command(force=True))
            return events

        if (
            self._last_voice_at is not None
            and (now - self._last_voice_at) * 1000 >= SILENCE_MS
            and len(self._command_buffer) > SAMPLE_RATE // 2
        ):
            events.extend(await self._finalize_command(force=True))

        return events

    async def _finalize_command(self, *, force: bool = False) -> list[dict[str, object]]:
        if not force and len(self._command_buffer) == 0:
            return [{"type": "stt_end"}]

        pcm = bytes(self._command_buffer)
        self._reset_command()
        self.mode = VoiceDesktopMode.PAUSED

        stt = get_stt_service()
        if not stt.available or not pcm:
            return [
                {"type": "stt_end"},
                {"type": "error", "message": "STT engine unavailable or empty audio."},
            ]

        import asyncio

        text = await asyncio.to_thread(stt.transcribe_pcm16, pcm)
        events: list[dict[str, object]] = []
        if text:
            events.append({"type": "stt_final", "text": text})
        events.append({"type": "stt_end"})
        return events

    def _reset_command(self) -> None:
        self._command_buffer = bytearray()
        self._command_started_at = None
        self._last_voice_at = None


def _has_voice_energy(chunk: bytes, threshold: int = 500) -> bool:
    if len(chunk) < 2:
        return False
    samples = np.frombuffer(chunk, dtype=np.int16)
    return float(np.abs(samples).mean()) >= threshold
