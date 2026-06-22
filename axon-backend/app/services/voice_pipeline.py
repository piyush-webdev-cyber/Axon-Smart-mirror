"""Coordinates wake-word → STT → Gemini → TTS for native desktop clients."""

from __future__ import annotations

import asyncio
import time
from enum import Enum
from typing import Any

import numpy as np

from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD
from app.services.stt_service import SAMPLE_RATE, get_stt_service
from app.services.tts_service import get_tts_service
from app.services.voice_service import process_voice_command
from app.services.wakeword_service import get_wakeword_service

logger = get_logger(__name__)

SILENCE_MS = 1200
MAX_COMMAND_MS = 8000
WAKE_ACK_PHRASE = "Yes?"


class PipelineState(str, Enum):
    STOPPED = "stopped"
    IDLE = "idle"
    RECORDING = "recording"
    PROCESSING = "processing"
    SPEAKING = "speaking"


class VoicePipeline:
    """Single-consumer streaming voice loop for Electron."""

    def __init__(self) -> None:
        self._state = PipelineState.STOPPED
        self._command_buffer = bytearray()
        self._command_started_at: float | None = None
        self._last_voice_at: float | None = None
        self._wake_mode = True
        self._lock = asyncio.Lock()
        self._event_subscribers: set[Any] = set()

    @property
    def state(self) -> PipelineState:
        return self._state

    @property
    def running(self) -> bool:
        return self._state != PipelineState.STOPPED

    def subscribe(self, callback: Any) -> None:
        self._event_subscribers.add(callback)

    def unsubscribe(self, callback: Any) -> None:
        self._event_subscribers.discard(callback)

    async def start(self) -> dict[str, object]:
        async with self._lock:
            self._state = PipelineState.IDLE
            self._wake_mode = True
            get_wakeword_service().reset()
            self._reset_command()
            logger.info("[WAKEWORD] Listening...")
            events = [
                self._event("status", state=self._state.value),
                self._event("listening_resumed", wakeWord=WAKE_WORD),
            ]
            await self._broadcast(events)
            return events[-1]

    async def stop(self) -> dict[str, object]:
        async with self._lock:
            self._state = PipelineState.STOPPED
            self._wake_mode = False
            self._reset_command()
            event = self._event("status", state=self._state.value)
            await self._broadcast([event])
            return event

    def status_payload(self) -> dict[str, object]:
        wake = get_wakeword_service()
        stt = get_stt_service()
        tts = get_tts_service()
        return {
            "running": self.running,
            "state": self._state.value,
            "wakeWord": WAKE_WORD,
            "wakeword": wake.status().__dict__,
            "stt": stt.status().__dict__,
            "tts": tts.status().__dict__,
        }

    async def handle_control(self, action: str) -> list[dict[str, object]]:
        if action == "pause_wake":
            self._wake_mode = False
            self._reset_command()
            return [self._event("status", state=self._state.value)]
        if action == "resume_wake" or action == "reset":
            self._wake_mode = True
            self._state = PipelineState.IDLE
            get_wakeword_service().reset()
            self._reset_command()
            logger.info("[WAKEWORD] Listening...")
            events = [
                self._event("status", state=self._state.value),
                self._event("listening_resumed", wakeWord=WAKE_WORD),
            ]
            await self._broadcast(events)
            return events
        if action == "start_stt":
            self._state = PipelineState.RECORDING
            self._reset_command()
            logger.info("[STT] Recording started")
            events = [
                self._event("recording_started"),
                self._event("status", state=self._state.value),
            ]
            await self._broadcast(events)
            return events
        if action == "stop_stt":
            return await self._finalize_command(force=True)
        return [self._event("error", message=f"Unknown control action: {action}")]

    async def handle_pcm(self, chunk: bytes) -> list[dict[str, object]]:
        if not self.running or not chunk:
            return []

        events: list[dict[str, object]] = []

        if self._state == PipelineState.IDLE and self._wake_mode:
            if get_wakeword_service().process_pcm16(chunk):
                logger.info("[WAKEWORD] Nexa detected")
                self._state = PipelineState.RECORDING
                self._reset_command()
                self._command_buffer.extend(chunk)
                self._command_started_at = time.monotonic()
                self._last_voice_at = self._command_started_at
                events.extend(
                    [
                        self._event("wakeword_detected", wakeWord=WAKE_WORD),
                        self._event("wake_detected", wakeWord=WAKE_WORD),
                        self._event("recording_started"),
                        self._event("status", state=self._state.value),
                    ],
                )
                logger.info("[STT] Recording started")
                await self._broadcast(events)
                ack_events = await self._speak_ack()
                events.extend(ack_events)
            return events

        if self._state != PipelineState.RECORDING:
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
        if self._state != PipelineState.RECORDING and not force:
            return [self._event("stt_end")]

        pcm = bytes(self._command_buffer)
        self._reset_command()
        self._state = PipelineState.PROCESSING
        self._wake_mode = False

        stt = get_stt_service()
        events: list[dict[str, object]] = [
            self._event("status", state=self._state.value),
        ]

        if not stt.available or not pcm:
            events.append(
                self._event("error", message="STT engine unavailable or empty audio."),
            )
            events.extend(await self._resume_listening())
            await self._broadcast(events)
            return events

        logger.info("[STT] Transcribing audio (%d bytes)", len(pcm))
        text = await asyncio.to_thread(stt.transcribe_pcm16, pcm)
        if text:
            logger.info("[STT] Transcript received: %s", text)
            events.append(self._event("stt_final", text=text))
        events.append(self._event("stt_end"))

        if text:
            events.extend(await self._process_and_speak(text))
        else:
            events.extend(await self._resume_listening())

        await self._broadcast(events)
        return events

    async def _process_and_speak(self, transcript: str) -> list[dict[str, object]]:
        events: list[dict[str, object]] = []
        self._state = PipelineState.PROCESSING
        events.append(self._event("processing_started", transcript=transcript))

        try:
            result = await process_voice_command(transcript)
        except Exception as exc:  # noqa: BLE001
            logger.exception("[AI] Response generation failed: %s", exc)
            events.append(self._event("error", message="Could not generate a response."))
            events.extend(await self._resume_listening())
            return events

        reply = str(result.get("reply", ""))
        logger.info("[AI] Response generated: %s", reply[:120])
        events.append(
            self._event(
                "response_ready",
                reply=reply,
                action=result.get("action"),
                source=result.get("source"),
            ),
        )

        if reply:
            self._state = PipelineState.SPEAKING
            events.append(self._event("speaking_started", text=reply))
            logger.info("[TTS] Speaking response")
            events.append(self._event("tts_text", text=reply))

        events.extend(await self._resume_listening())
        return events

    async def _speak_ack(self) -> list[dict[str, object]]:
        events: list[dict[str, object]] = []
        prev_state = self._state
        self._state = PipelineState.SPEAKING
        events.append(self._event("speaking_started", text=WAKE_ACK_PHRASE))
        logger.info("[TTS] Speaking response")
        events.append(self._event("tts_text", text=WAKE_ACK_PHRASE))
        self._state = prev_state
        return events

    async def _resume_listening(self) -> list[dict[str, object]]:
        self._state = PipelineState.IDLE
        self._wake_mode = True
        get_wakeword_service().reset()
        self._reset_command()
        logger.info("[WAKEWORD] Listening...")
        return [
            self._event("listening_resumed", wakeWord=WAKE_WORD),
            self._event("wake_armed", wakeWord=WAKE_WORD),
            self._event("status", state=self._state.value),
        ]

    async def synthesize(self, text: str) -> bytes:
        return await asyncio.to_thread(get_tts_service().synthesize_wav, text)

    def _reset_command(self) -> None:
        self._command_buffer = bytearray()
        self._command_started_at = None
        self._last_voice_at = None

    def _event(self, event_type: str, **payload: object) -> dict[str, object]:
        return {"type": event_type, **payload}

    async def _broadcast(self, events: list[dict[str, object]]) -> None:
        for callback in list(self._event_subscribers):
            try:
                result = callback(events)
                if asyncio.iscoroutine(result):
                    await result
            except Exception as exc:  # noqa: BLE001
                logger.warning("Voice pipeline subscriber error: %s", exc)


def _has_voice_energy(chunk: bytes, threshold: int = 500) -> bool:
    if len(chunk) < 2:
        return False
    samples = np.frombuffer(chunk, dtype=np.int16)
    return float(np.abs(samples).mean()) >= threshold


_pipeline: VoicePipeline | None = None


def get_voice_pipeline() -> VoicePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = VoicePipeline()
    return _pipeline
