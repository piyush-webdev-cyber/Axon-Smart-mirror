"""Capture microphone audio inside the Python backend (Electron desktop).

Browser/Electron renderer AudioContext often stays suspended until a click,
which breaks hands-free wake word. This service feeds PCM directly to the
voice pipeline from the OS default microphone via sounddevice.
"""

from __future__ import annotations

import asyncio
from typing import Any

import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)

try:
    import sounddevice as sd

    _SD_IMPORT_ERROR: str | None = None
except ImportError as exc:  # pragma: no cover
    sd = None  # type: ignore[assignment]
    _SD_IMPORT_ERROR = str(exc)

SAMPLE_RATE = 16_000
BLOCK_SIZE = 4096
_LOG_EVERY_CHUNKS = 25


class LocalMicService:
    def __init__(self) -> None:
        self._stream: Any | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._running = False
        self._bytes_sent = 0
        self._chunk_count = 0
        self._dropped_not_running = 0
        self._last_log_at = 0.0

    @property
    def available(self) -> bool:
        return sd is not None

    @property
    def running(self) -> bool:
        return self._running

    @property
    def bytes_sent(self) -> int:
        return self._bytes_sent

    def start(self, loop: asyncio.AbstractEventLoop) -> bool:
        if self._running:
            logger.info("[VOICE] Microphone already running (bytes_sent=%d)", self._bytes_sent)
            return True
        if sd is None:
            logger.error(
                "[VOICE] Local mic unavailable — install sounddevice: %s",
                _SD_IMPORT_ERROR,
            )
            return False

        self._loop = loop
        try:
            device = sd.default.device[0]
            device_info = sd.query_devices(device, "input")
            logger.info(
                "[VOICE] Opening input device #%s: %s",
                device,
                device_info.get("name", "unknown"),
            )
            self._stream = sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="float32",
                blocksize=BLOCK_SIZE,
                callback=self._audio_callback,
            )
            self._stream.start()
            self._running = True
            self._chunk_count = 0
            self._dropped_not_running = 0
            logger.info("[VOICE] Microphone Initialized (backend sounddevice @ %d Hz)", SAMPLE_RATE)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.exception("[VOICE] Failed to open microphone: %s", exc)
            self._stream = None
            self._running = False
            return False

    def stop(self) -> None:
        self._running = False
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception as exc:  # noqa: BLE001
                logger.warning("[VOICE] Mic stop error: %s", exc)
            self._stream = None
        logger.info("[VOICE] Microphone stopped (total bytes_sent=%d)", self._bytes_sent)

    def _audio_callback(
        self,
        indata: np.ndarray,
        _frames: int,
        _time: Any,
        status: Any,
    ) -> None:
        if status:
            logger.warning("[VOICE] Mic stream status: %s", status)
        if not self._running or self._loop is None:
            return

        mono = indata[:, 0] if indata.ndim > 1 else indata
        clipped = np.clip(mono, -1.0, 1.0)
        pcm = (clipped * 32767.0).astype(np.int16).tobytes()
        if not pcm:
            return

        self._bytes_sent += len(pcm)
        self._chunk_count += 1
        if self._chunk_count == 1 or self._chunk_count % _LOG_EVERY_CHUNKS == 0:
            rms = float(np.sqrt(np.mean(clipped.astype(np.float64) ** 2)))
            logger.info(
                "[VOICE] PCM Chunk Received (#%d, rms=%.4f)",
                self._chunk_count,
                rms,
            )
            logger.info("[VOICE] PCM Bytes Sent: %d", self._bytes_sent)

        asyncio.run_coroutine_threadsafe(self._feed_pcm(pcm), self._loop)

    async def _feed_pcm(self, pcm: bytes) -> None:
        from app.services.voice_pipeline import get_voice_pipeline

        pipeline = get_voice_pipeline()
        if not pipeline.running:
            self._dropped_not_running += 1
            if self._dropped_not_running in (1, 10, 100) or self._dropped_not_running % 500 == 0:
                logger.warning(
                    "[VOICE] PCM dropped — pipeline not running (dropped=%d, state=%s)",
                    self._dropped_not_running,
                    pipeline.state.value,
                )
            return
        await pipeline.handle_pcm(pcm)


_local_mic: LocalMicService | None = None


def get_local_mic_service() -> LocalMicService:
    global _local_mic
    if _local_mic is None:
        _local_mic = LocalMicService()
    return _local_mic
