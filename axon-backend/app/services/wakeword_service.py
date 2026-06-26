"""Local wake-word detection via OpenWakeWord or Porcupine (optional deps).

Install voice extras: ``pip install -r requirements-voice.txt``
Place a custom ``nexa.onnx`` at ``AXON_WAKEWORD_MODEL_PATH`` for the Nexa wake word,
or set ``AXON_PORCUPINE_ACCESS_KEY`` + ``AXON_PORCUPINE_KEYWORD_PATH``.
"""

from __future__ import annotations

import importlib.metadata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import numpy as np

from app.core.logging import get_logger
from app.core.voice_config import WAKE_WORD

logger = get_logger(__name__)

try:
    import openwakeword
    from openwakeword.model import Model as OpenWakeWordModel
    from openwakeword.utils import download_models as download_oww_models

    _OWW_IMPORT_ERROR: str | None = None
except ImportError as exc:  # pragma: no cover
    openwakeword = None  # type: ignore[assignment]
    OpenWakeWordModel = None  # type: ignore[misc, assignment]
    download_oww_models = None  # type: ignore[misc, assignment]
    _OWW_IMPORT_ERROR = str(exc)


def _oww_installed_version() -> str | None:
    """Return the installed openwakeword package version (never 'unknown')."""
    if openwakeword is None:
        return None
    try:
        return importlib.metadata.version("openwakeword")
    except importlib.metadata.PackageNotFoundError:
        return getattr(openwakeword, "__version__", None)


_OWW_VERSION = _oww_installed_version()

try:
    import pvporcupine

    _PORCUPINE_IMPORT_ERROR: str | None = None
except ImportError as exc:  # pragma: no cover
    pvporcupine = None  # type: ignore[assignment]
    _PORCUPINE_IMPORT_ERROR = str(exc)

SAMPLE_RATE = 16_000
FRAME_SAMPLES = 1280
_OWW_EXPECTED_DTYPE = "int16"
_DEBUG_THRESHOLDS = (0.001, 0.01, 0.05, 0.20)


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


def _infer_oww_pretrained_name(model_path: Path | None) -> str:
    """Map a local .onnx filename to an OpenWakeWord pretrained bundle name."""
    if model_path is None:
        return "hey_jarvis_v0.1"
    stem = model_path.stem.lower()
    if "jarvis" in stem:
        return "hey_jarvis_v0.1"
    if "alexa" in stem:
        return "alexa_v0.1"
    if "mycroft" in stem:
        return "hey_mycroft_v0.1"
    if "rhasspy" in stem:
        return "hey_rhasspy_v0.1"
    return "hey_jarvis_v0.1"


def _ensure_openwakeword_assets(model_path: Path | None) -> None:
    """Download melspectrogram/embedding ONNX files required by every OWW model."""
    if download_oww_models is None:
        return
    pretrained = _infer_oww_pretrained_name(model_path)
    try:
        logger.info("[WAKEWORD] Ensuring OpenWakeWord assets (%s)...", pretrained)
        download_oww_models(model_names=[pretrained])
    except Exception as exc:  # noqa: BLE001
        logger.warning("[WAKEWORD] OpenWakeWord asset download failed: %s", exc)


def _onnx_model_file(session: Any) -> str | None:
    path = getattr(session, "_model_path", None)
    return str(path) if path else None


class OpenWakeWordScorer:
    def __init__(self, model_path: str | None, threshold: float) -> None:
        self._threshold = threshold
        self._model_path = model_path
        self._model: Any | None = None
        self._model_keys: list[str] = []
        self._onnx_paths: dict[str, str] = {}
        self._inference_count = 0
        self._last_scores: dict[str, float] = {}
        self._last_rms = 0.0
        self._init_model()

    @property
    def available(self) -> bool:
        return self._model is not None

    @property
    def resolved_model_path(self) -> str | None:
        if self._onnx_paths:
            return next(iter(self._onnx_paths.values()))
        return self._model_path

    @property
    def threshold(self) -> float:
        return self._threshold

    def debug_state(self) -> dict[str, object]:
        return {
            "openwakewordVersion": _OWW_VERSION,
            "availableModels": list(self._model_keys),
            "onnxModelPaths": dict(self._onnx_paths),
            "lastPredictionScores": dict(self._last_scores),
            "inferenceCount": self._inference_count,
            "lastAudioRms": round(self._last_rms, 6),
            "threshold": self._threshold,
            "pcmSampleRate": SAMPLE_RATE,
            "pcmDtypeExpected": _OWW_EXPECTED_DTYPE,
        }

    def reset(self) -> None:
        if self._model is not None:
            self._model.reset()

    def process_pcm16(self, chunk: bytes) -> bool:
        if not self._model or not chunk:
            return False

        samples = np.frombuffer(chunk, dtype=np.int16)
        if samples.size == 0:
            return False

        audio_f = samples.astype(np.float32) / 32768.0
        self._last_rms = float(np.sqrt(np.mean(audio_f.astype(np.float64) ** 2)))
        pcm_min = int(samples.min())
        pcm_max = int(samples.max())
        pcm_mean = float(samples.mean())

        self._inference_count += 1
        n = self._inference_count

        if n <= 5 or n % 25 == 0:
            logger.info(
                "[WAKEWORD] PCM sample_rate=%d dtype=%s length=%d (OpenWakeWord expects int16 @ 16kHz, multiples of 1280)",
                SAMPLE_RATE,
                samples.dtype,
                samples.size,
            )
            logger.info(
                "[WAKEWORD] PCM stats min=%d max=%d mean=%.2f rms=%.6f",
                pcm_min,
                pcm_max,
                pcm_mean,
                self._last_rms,
            )
            if samples.dtype != np.int16:
                logger.error("[WAKEWORD] PCM dtype mismatch — expected int16, got %s", samples.dtype)
            elif pcm_max == 0 and pcm_min == 0 and self._last_rms < 1e-6:
                logger.warning("[WAKEWORD] PCM appears silent (all zeros)")

        logger.info("[WAKEWORD] Running OpenWakeWord inference...")
        try:
            # OpenWakeWord melspectrogram path requires int16 PCM — NOT float-normalized audio.
            # Passing float32 in [-1,1] gets cast back to int16 as 0 inside the preprocessor.
            raw_scores = self._model.predict(samples)
        except Exception as exc:  # noqa: BLE001
            logger.exception("[WAKEWORD] predict() failed: %s", exc)
            return False
        logger.info("[WAKEWORD] Inference complete.")

        normalized = {str(k): float(v) for k, v in raw_scores.items()}
        self._last_scores = normalized
        if raw_scores:
            self._model_keys = list(raw_scores.keys())

        logger.info("[WAKEWORD] Prediction: %s", normalized)
        logger.info("[WAKEWORD] Prediction keys: %s", list(raw_scores.keys()))
        if self._model_keys:
            for key in self._model_keys:
                if key not in normalized:
                    logger.error(
                        "[WAKEWORD] KEY MISMATCH — model.models key '%s' missing from prediction dict %s",
                        key,
                        list(normalized.keys()),
                    )

        peak = max(normalized.values()) if normalized else 0.0
        peak_key = max(normalized, key=normalized.get) if normalized else ""
        probes = ", ".join(
            f"{t}={'HIT' if peak >= t else 'miss'}"
            for t in _DEBUG_THRESHOLDS
        )
        logger.info("[WAKEWORD] Threshold probe (peak %s=%.6f): %s", peak_key, peak, probes)

        detected = False
        for name, value in normalized.items():
            if value >= self._threshold:
                logger.info(
                    "[WAKEWORD] Detection Score: %s=%.4f (threshold=%.2f)",
                    name,
                    value,
                    self._threshold,
                )
                logger.info("[WAKEWORD] Wake Word Detected")
                detected = True
                self.reset()
                break

        return detected

    def _init_model(self) -> None:
        if OpenWakeWordModel is None:
            logger.warning("OpenWakeWord not installed: %s", _OWW_IMPORT_ERROR)
            return

        try:
            local_file = self._resolve_model_path()
            if local_file is not None:
                load_target = str(local_file)
                logger.info("[WAKEWORD] Using configured model file: %s", load_target)
            else:
                load_target = "hey_jarvis_v0.1"
                logger.info("[WAKEWORD] No local model file — using pretrained: %s", load_target)

            _ensure_openwakeword_assets(local_file)
            self._model = OpenWakeWordModel(
                wakeword_models=[load_target],
                inference_framework="onnx",
            )
            self._model_keys = list(self._model.models.keys())
            self._onnx_paths = {
                key: path
                for key, session in self._model.models.items()
                if (path := _onnx_model_file(session))
            }

            logger.info("[WAKEWORD] Engine: OpenWakeWord")
            logger.info("[WAKEWORD] OpenWakeWord version: %s", _OWW_VERSION)
            logger.info("[WAKEWORD] model.models.keys(): %s", self._model_keys)
            for key, path in self._onnx_paths.items():
                logger.info("[WAKEWORD] Model file loaded: %s (prediction key: '%s')", path, key)
            logger.info("[WAKEWORD] Available: true")
            logger.info("[WAKEWORD] Detector Active")
            logger.info("[WAKEWORD] Threshold: %.2f", self._threshold)

            probe = self._model.predict(np.zeros(FRAME_SAMPLES, dtype=np.int16))
            probe_norm = {str(k): float(v) for k, v in probe.items()}
            logger.info("[WAKEWORD] Startup probe (int16 silence): %s", probe_norm)
            self._last_scores = probe_norm
            self._model_path = self.resolved_model_path
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


class PorcupineBuiltinScorer:
    """Picovoice built-in keywords (e.g. ``jarvis``) — no custom .ppn file."""

    def __init__(self, access_key: str, keyword: str = "jarvis") -> None:
        self._access_key = access_key
        self._keyword = keyword
        self._porcupine: Any | None = None
        self._buffer = np.zeros(0, dtype=np.int16)
        self._init_engine()

    @property
    def available(self) -> bool:
        return self._porcupine is not None

    @property
    def resolved_model_path(self) -> str | None:
        return f"porcupine:builtin:{self._keyword}" if self.available else None

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
                logger.info("[WAKEWORD] Jarvis Detected (porcupine builtin)")
                detected = True
                self.reset()
                break
        return detected

    def _init_engine(self) -> None:
        if pvporcupine is None:
            logger.warning("Porcupine not installed: %s", _PORCUPINE_IMPORT_ERROR)
            return
        try:
            self._porcupine = pvporcupine.create(
                access_key=self._access_key,
                keywords=[self._keyword],
                sensitivities=[0.55],
            )
            logger.info("[WAKEWORD] Model Loaded: Porcupine builtin '%s'", self._keyword)
        except Exception as exc:  # noqa: BLE001
            logger.exception("[WAKEWORD] Porcupine builtin init failed: %s", exc)
            self._porcupine = None

    def close(self) -> None:
        if self._porcupine is not None:
            self._porcupine.delete()
            self._porcupine = None


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
        threshold: float = 0.4,
        *,
        porcupine_access_key: str | None = None,
        porcupine_keyword_path: str | None = None,
        engine: str = "auto",
    ) -> None:
        self._engine_name = "none"
        self._scorer: WakeWordScorer | None = None
        self._model_path: str | None = model_path
        self._threshold = threshold
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
            logger.warning("[WAKEWORD] process_pcm16() — no scorer loaded")
            return False
        return self._scorer.process_pcm16(chunk)

    def debug_info(self) -> dict[str, object]:
        status = self.status()
        payload: dict[str, object] = {
            "engine": status.engine,
            "modelName": status.model_path,
            "threshold": self._threshold,
            "available": status.available,
            "wakeWord": status.wake_word,
            "openwakewordVersion": _OWW_VERSION,
            "availableModels": [],
            "lastPredictionScores": {},
            "inferenceCount": 0,
        }
        if hasattr(self._scorer, "debug_state"):
            payload.update(self._scorer.debug_state())  # type: ignore[union-attr]
        return payload

    def log_engine_status(self) -> None:
        status = self.status()
        logger.info("[WAKEWORD] Engine: %s", status.engine)
        logger.info("[WAKEWORD] Model Loaded: %s", status.model_path or "none")
        logger.info("[WAKEWORD] Available: %s", status.available)
        if status.available:
            logger.info("[WAKEWORD] Detector Active")

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

        if porcupine_access_key and not porcupine_keyword_path and not prefer_oww:
            builtin = PorcupineBuiltinScorer(porcupine_access_key, keyword="jarvis")
            if builtin.available:
                self._scorer = builtin
                self._engine_name = "porcupine-builtin"
                self._model_path = builtin.resolved_model_path
                return
            builtin.close()

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
                self.log_engine_status()
                return

        if porcupine_access_key and porcupine_keyword_path:
            scorer = PorcupineScorer(porcupine_access_key, porcupine_keyword_path)
            if scorer.available:
                self._scorer = scorer
                self._engine_name = "porcupine"
                self._model_path = porcupine_keyword_path
                self.log_engine_status()


_wakeword_service: WakeWordService | None = None


def get_wakeword_service(
    model_path: str | None = None,
    *,
    threshold: float = 0.4,
    porcupine_access_key: str | None = None,
    porcupine_keyword_path: str | None = None,
    engine: str = "auto",
) -> WakeWordService:
    global _wakeword_service
    if _wakeword_service is None:
        _wakeword_service = WakeWordService(
            model_path=model_path,
            threshold=threshold,
            porcupine_access_key=porcupine_access_key,
            porcupine_keyword_path=porcupine_keyword_path,
            engine=engine,
        )
    return _wakeword_service


def get_wakeword_debug_info() -> dict[str, object]:
    """Snapshot for GET /voice/debug."""
    return get_wakeword_service().debug_info()


def effective_listen_phrase(model_path: str | None = None) -> str:
    """Human phrase the user should speak for the loaded wake model."""
    try:
        if _wakeword_service is not None and _wakeword_service.status().engine == "porcupine-builtin":
            return "Jarvis"
    except Exception:  # noqa: BLE001
        pass
    path = (model_path or "").lower()
    if "jarvis" in path:
        return "hey jarvis"
    if "alexa" in path:
        return "alexa"
    if "mycroft" in path:
        return "hey mycroft"
    return "Nexa"
