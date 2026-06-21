"""Local wake-word detection via OpenWakeWord (optional dependency).

Install voice extras: ``pip install -r requirements-voice.txt``
Place a custom ``nexa.onnx`` model at ``AXON_WAKEWORD_MODEL_PATH`` for the Nexa wake word.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD

logger = get_logger(__name__)

try:
    from openwakeword.model import Model as OpenWakeWordModel

    _OWW_IMPORT_ERROR: str | None = None
except ImportError as exc:  # pragma: no cover - optional dependency
    OpenWakeWordModel = None  # type: ignore[misc, assignment]
    _OWW_IMPORT_ERROR = str(exc)

SAMPLE_RATE = 16_000
# OpenWakeWord expects 1280-sample (80 ms) frames at 16 kHz.
FRAME_SAMPLES = 1280


@dataclass(frozen=True)
class WakeWordEngineStatus:
    available: bool
    engine: str
    wake_word: str
    model_path: str | None
    detail: str | None = None


class WakeWordService:
    """Streaming wake-word scorer. Thread-safe for a single asyncio loop consumer."""

    def __init__(self, model_path: str | None = None, threshold: float = 0.55) -> None:
        self._model_path = model_path
        self._threshold = threshold
        self._model: Any | None = None
        self._buffer = np.zeros(0, dtype=np.int16)
        self._init_model()

    @property
    def available(self) -> bool:
        return self._model is not None

    def status(self) -> WakeWordEngineStatus:
        if self._model is None:
            detail = _OWW_IMPORT_ERROR or "Wake-word model not loaded."
            return WakeWordEngineStatus(
                available=False,
                engine="openwakeword",
                wake_word=WAKE_WORD,
                model_path=self._model_path,
                detail=detail,
            )
        return WakeWordEngineStatus(
            available=True,
            engine="openwakeword",
            wake_word=WAKE_WORD,
            model_path=self._model_path,
        )

    def reset(self) -> None:
        self._buffer = np.zeros(0, dtype=np.int16)

    def process_pcm16(self, chunk: bytes) -> bool:
        """Feed PCM16 mono audio. Returns True when wake word is detected."""
        if not self._model or not chunk:
            return False

        samples = np.frombuffer(chunk, dtype=np.int16)
        if samples.size == 0:
            return False

        self._buffer = np.concatenate([self._buffer, samples])

        detected = False
        while self._buffer.size >= FRAME_SAMPLES:
            frame = self._buffer[:FRAME_SAMPLES]
            self._buffer = self._buffer[FRAME_SAMPLES:]

            audio = frame.astype(np.float32) / 32768.0
            scores = self._model.predict(audio)

            for _name, score in scores.items():
                if float(score) >= self._threshold:
                    logger.info("Wake word detected (score=%.3f)", float(score))
                    detected = True
                    self.reset()
                    break

        return detected

    def _init_model(self) -> None:
        if OpenWakeWordModel is None:
            logger.warning("OpenWakeWord not installed: %s", _OWW_IMPORT_ERROR)
            return

        path = self._resolve_model_path()
        try:
            if path:
                self._model = OpenWakeWordModel(
                    wakeword_models=[str(path)],
                    inference_framework="onnx",
                )
                self._model_path = str(path)
                logger.info("Wake-word model loaded: %s", path)
            else:
                # Dev fallback: bundled pre-trained models (not "Nexa" — for pipeline testing).
                self._model = OpenWakeWordModel(inference_framework="onnx")
                self._model_path = None
                logger.warning(
                    "No custom Nexa model at AXON_WAKEWORD_MODEL_PATH; "
                    "using OpenWakeWord default models for pipeline testing only.",
                )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to load wake-word model: %s", exc)
            self._model = None

    def _resolve_model_path(self) -> Path | None:
        if not self._model_path:
            return None
        candidate = Path(self._model_path)
        if candidate.is_file():
            return candidate
        logger.warning("Wake-word model not found: %s", candidate)
        return None


_wakeword_service: WakeWordService | None = None


def get_wakeword_service(model_path: str | None = None) -> WakeWordService:
    global _wakeword_service
    if _wakeword_service is None:
        _wakeword_service = WakeWordService(model_path=model_path)
    return _wakeword_service
