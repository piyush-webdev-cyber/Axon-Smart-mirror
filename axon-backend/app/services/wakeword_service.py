"""Local wake-word detection via OpenWakeWord or Porcupine (optional deps).

Install voice extras: ``pip install -r requirements-voice.txt``
Place a custom ``nexa.onnx`` at ``AXON_WAKEWORD_MODEL_PATH`` for the Nexa wake word,
or set ``AXON_PORCUPINE_ACCESS_KEY`` + ``AXON_PORCUPINE_KEYWORD_PATH``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import numpy as np

from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD

logger = get_logger(__name__)

try:
    from openwakeword.model import Model as OpenWakeWordModel

    _OWW_IMPORT_ERROR: str | None = None
except ImportError as exc:  # pragma: no cover
    OpenWakeWordModel = None  # type: ignore[misc, assignment]
    _OWW_IMPORT_ERROR = str(exc)

try:
    import pvporcupine

    _PORCUPINE_IMPORT_ERROR: str | None = None
except ImportError as exc:  # pragma: no cover
    pvporcupine = None  # type: ignore[assignment]
    _PORCUPINE_IMPORT_ERROR = str(exc)

SAMPLE_RATE = 16_000
FRAME_SAMPLES = 1280


@dataclass(frozen=True)
class WakeWordEngineStatus:
    available: bool
    engine: str
    wake_word: str
    model_path: str | None
    detail: str | None = None


class WakeWordScorer(Protocol):
    def reset(self) -> None: ...
    def process_pcm16(self, chunk: bytes) -> bool: ...


class OpenWakeWordScorer:
    def __init__(self, model_path: str | None, threshold: float) -> None:
        self._threshold = threshold
        self._model_path = model_path
        self._model: Any | None = None
        self._buffer = np.zeros(0, dtype=np.int16)
        self._init_model()

    @property
    def available(self) -> bool:
        return self._model is not None

    @property
    def resolved_model_path(self) -> str | None:
        return self._model_path

    def reset(self) -> None:
        self._buffer = np.zeros(0, dtype=np.int16)

    def process_pcm16(self, chunk: bytes) -> bool:
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
            for name, score in scores.items():
                if float(score) >= self._threshold:
                    logger.info("[WAKEWORD] Nexa detected (openwakeword %s=%.3f)", name, float(score))
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
                logger.info("[WAKEWORD] Model loaded: %s", path)
            else:
                bundled = _default_nexa_model_path()
                if bundled:
                    self._model = OpenWakeWordModel(
                        wakeword_models=[str(bundled)],
                        inference_framework="onnx",
                    )
                    self._model_path = str(bundled)
                    logger.info("[WAKEWORD] Bundled Nexa model loaded: %s", bundled)
                else:
                    self._model = OpenWakeWordModel(inference_framework="onnx")
                    self._model_path = None
                    logger.warning(
                        "[WAKEWORD] No Nexa model configured — using OpenWakeWord defaults "
                        "(will NOT detect 'Nexa'; set AXON_WAKEWORD_MODEL_PATH or Porcupine).",
                    )
        except Exception as exc:  # noqa: BLE001
            logger.exception("[WAKEWORD] Failed to load OpenWakeWord model: %s", exc)
            self._model = None

    def _resolve_model_path(self) -> Path | None:
        if not self._model_path:
            return None
        candidate = Path(self._model_path)
        if candidate.is_file():
            return candidate
        logger.warning("[WAKEWORD] Model not found: %s", candidate)
        return None


class PorcupineScorer:
    def __init__(self, access_key: str, keyword_path: str) -> None:
        self._access_key = access_key
        self._keyword_path = keyword_path
        self._porcupine: Any | None = None
        self._buffer = np.zeros(0, dtype=np.int16)
        self._init_engine()

    @property
    def available(self) -> bool:
        return self._porcupine is not None

    @property
    def resolved_model_path(self) -> str | None:
        return self._keyword_path if self.available else None

    def reset(self) -> None:
        self._buffer = np.zeros(0, dtype=np.int16)

    def process_pcm16(self, chunk: bytes) -> bool:
        if not self._porcupine or not chunk:
            return False

        samples = np.frombuffer(chunk, dtype=np.int16)
        self._buffer = np.concatenate([self._buffer, samples])
        frame_length = self._porcupine.frame_length

        detected = False
        while self._buffer.size >= frame_length:
            frame = self._buffer[:frame_length]
            self._buffer = self._buffer[frame_length:]
            keyword_index = self._porcupine.process(frame)
            if keyword_index >= 0:
                logger.info("[WAKEWORD] Nexa detected (porcupine index=%s)", keyword_index)
                detected = True
                self.reset()
                break
        return detected

    def _init_engine(self) -> None:
        if pvporcupine is None:
            logger.warning("Porcupine not installed: %s", _PORCUPINE_IMPORT_ERROR)
            return
        keyword = Path(self._keyword_path)
        if not keyword.is_file():
            logger.warning("[WAKEWORD] Porcupine keyword not found: %s", keyword)
            return
        try:
            self._porcupine = pvporcupine.create(
                access_key=self._access_key,
                keyword_paths=[str(keyword)],
                sensitivities=[0.55],
            )
            logger.info("[WAKEWORD] Porcupine keyword loaded: %s", keyword)
        except Exception as exc:  # noqa: BLE001
            logger.exception("[WAKEWORD] Porcupine init failed: %s", exc)
            self._porcupine = None

    def close(self) -> None:
        if self._porcupine is not None:
            self._porcupine.delete()
            self._porcupine = None


def _default_nexa_model_path() -> Path | None:
    candidates = [
        Path(__file__).resolve().parents[2] / "models" / "nexa.onnx",
        Path(__file__).resolve().parents[2] / "models" / "nexa.tflite",
    ]
    for path in candidates:
        if path.is_file():
            return path
    return None


class WakeWordService:
    def __init__(
        self,
        model_path: str | None = None,
        threshold: float = 0.55,
        *,
        porcupine_access_key: str | None = None,
        porcupine_keyword_path: str | None = None,
        engine: str = "auto",
    ) -> None:
        self._engine_name = "none"
        self._scorer: WakeWordScorer | None = None
        self._model_path: str | None = model_path
        self._init_scorer(
            model_path=model_path,
            threshold=threshold,
            porcupine_access_key=porcupine_access_key,
            porcupine_keyword_path=porcupine_keyword_path,
            engine=engine,
        )

    @property
    def available(self) -> bool:
        return self._scorer is not None and getattr(self._scorer, "available", False)

    def status(self) -> WakeWordEngineStatus:
        if not self.available:
            detail = _OWW_IMPORT_ERROR or _PORCUPINE_IMPORT_ERROR or "Wake-word engine not loaded."
            return WakeWordEngineStatus(
                available=False,
                engine=self._engine_name,
                wake_word=WAKE_WORD,
                model_path=self._model_path,
                detail=detail,
            )
        model_path = getattr(self._scorer, "resolved_model_path", self._model_path)
        return WakeWordEngineStatus(
            available=True,
            engine=self._engine_name,
            wake_word=WAKE_WORD,
            model_path=model_path,
        )

    def reset(self) -> None:
        if self._scorer:
            self._scorer.reset()

    def process_pcm16(self, chunk: bytes) -> bool:
        if not self._scorer:
            return False
        return self._scorer.process_pcm16(chunk)

    def _init_scorer(
        self,
        *,
        model_path: str | None,
        threshold: float,
        porcupine_access_key: str | None,
        porcupine_keyword_path: str | None,
        engine: str,
    ) -> None:
        prefer_porcupine = engine == "porcupine"
        prefer_oww = engine == "openwakeword"

        if not prefer_oww and porcupine_access_key and porcupine_keyword_path:
            scorer = PorcupineScorer(porcupine_access_key, porcupine_keyword_path)
            if scorer.available:
                self._scorer = scorer
                self._engine_name = "porcupine"
                self._model_path = porcupine_keyword_path
                return
            scorer.close()

        if not prefer_porcupine:
            oww = OpenWakeWordScorer(model_path, threshold)
            if oww.available:
                self._scorer = oww
                self._engine_name = "openwakeword"
                self._model_path = oww.resolved_model_path
                return

        if porcupine_access_key and porcupine_keyword_path:
            scorer = PorcupineScorer(porcupine_access_key, porcupine_keyword_path)
            if scorer.available:
                self._scorer = scorer
                self._engine_name = "porcupine"
                self._model_path = porcupine_keyword_path


_wakeword_service: WakeWordService | None = None


def get_wakeword_service(
    model_path: str | None = None,
    *,
    porcupine_access_key: str | None = None,
    porcupine_keyword_path: str | None = None,
    engine: str = "auto",
) -> WakeWordService:
    global _wakeword_service
    if _wakeword_service is None:
        _wakeword_service = WakeWordService(
            model_path=model_path,
            porcupine_access_key=porcupine_access_key,
            porcupine_keyword_path=porcupine_keyword_path,
            engine=engine,
        )
    return _wakeword_service
