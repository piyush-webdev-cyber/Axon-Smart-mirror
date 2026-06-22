"""Speech-to-text via Faster-Whisper (optional dependency)."""

from __future__ import annotations

import io
import tempfile
import wave
from dataclasses import dataclass
from typing import Any

import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)

try:
    from faster_whisper import WhisperModel

    _WHISPER_IMPORT_ERROR: str | None = None
except ImportError as exc:  # pragma: no cover
    WhisperModel = None  # type: ignore[misc, assignment]
    _WHISPER_IMPORT_ERROR = str(exc)

SAMPLE_RATE = 16_000


@dataclass(frozen=True)
class SttEngineStatus:
    available: bool
    engine: str
    model: str
    detail: str | None = None


class SttService:
    def __init__(self, model_size: str = "base.en", device: str = "cpu") -> None:
        self._model_size = model_size
        self._device = device
        self._model: Any | None = None
        self._init_model()

    @property
    def available(self) -> bool:
        return self._model is not None

    def status(self) -> SttEngineStatus:
        if self._model is None:
            detail = _WHISPER_IMPORT_ERROR or "Whisper model not loaded."
            return SttEngineStatus(
                available=False,
                engine="faster-whisper",
                model=self._model_size,
                detail=detail,
            )
        return SttEngineStatus(
            available=True,
            engine="faster-whisper",
            model=self._model_size,
        )

    def transcribe_pcm16(self, pcm: bytes) -> str:
        """Transcribe mono PCM16 audio at 16 kHz."""
        if not self._model or not pcm:
            return ""

        samples = np.frombuffer(pcm, dtype=np.int16)
        if samples.size == 0:
            return ""

        wav_bytes = _pcm16_to_wav(samples)
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=True) as tmp:
            tmp.write(wav_bytes)
            tmp.flush()
            segments, _info = self._model.transcribe(
                tmp.name,
                language="en",
                vad_filter=True,
                beam_size=1,
            )
            text = " ".join(segment.text.strip() for segment in segments).strip()
            return text

    def _init_model(self) -> None:
        if WhisperModel is None:
            logger.warning("faster-whisper not installed: %s", _WHISPER_IMPORT_ERROR)
            return
        try:
            compute_type = "int8" if self._device == "cpu" else "float16"
            self._model = WhisperModel(
                self._model_size,
                device=self._device,
                compute_type=compute_type,
            )
            logger.info(
                "[STT] Model loaded: %s (device=%s)",
                self._model_size,
                self._device,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to load STT model: %s", exc)
            self._model = None


def _pcm16_to_wav(samples: np.ndarray) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(samples.tobytes())
    return buf.getvalue()


_stt_service: SttService | None = None


def get_stt_service(model_size: str = "base.en", device: str = "cpu") -> SttService:
    global _stt_service
    if _stt_service is None:
        _stt_service = SttService(model_size=model_size, device=device)
    return _stt_service
