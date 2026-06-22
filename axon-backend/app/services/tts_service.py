"""Text-to-speech via Piper (optional external binary)."""

from __future__ import annotations

import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)


@dataclass(frozen=True)
class TtsEngineStatus:
    available: bool
    engine: str
    piper_bin: str | None
    piper_model: str | None
    detail: str | None = None


class TtsService:
    def __init__(self, piper_bin: str | None = None, piper_model: str | None = None) -> None:
        self._piper_bin = piper_bin
        self._piper_model = piper_model

    @property
    def available(self) -> bool:
        return bool(self._piper_bin and self._piper_model and Path(self._piper_bin).is_file())

    def status(self) -> TtsEngineStatus:
        if not self.available:
            return TtsEngineStatus(
                available=False,
                engine="piper",
                piper_bin=self._piper_bin,
                piper_model=self._piper_model,
                detail="Set AXON_PIPER_BIN and AXON_PIPER_MODEL to enable Piper TTS.",
            )
        return TtsEngineStatus(
            available=True,
            engine="piper",
            piper_bin=self._piper_bin,
            piper_model=self._piper_model,
        )

    def synthesize_wav(self, text: str) -> bytes:
        if not self.available or not text.strip():
            return b""

        assert self._piper_bin is not None
        assert self._piper_model is not None

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as out:
            out_path = out.name

        try:
            proc = subprocess.run(
                [
                    self._piper_bin,
                    "--model",
                    self._piper_model,
                    "--output_file",
                    out_path,
                ],
                input=text.strip(),
                capture_output=True,
                text=True,
                check=False,
                timeout=30,
            )
            if proc.returncode != 0:
                logger.error("[TTS] Piper failed: %s", proc.stderr)
                return b""
            return Path(out_path).read_bytes()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Piper synthesis error: %s", exc)
            return b""
        finally:
            Path(out_path).unlink(missing_ok=True)


_tts_service: TtsService | None = None


def get_tts_service(piper_bin: str | None = None, piper_model: str | None = None) -> TtsService:
    global _tts_service
    if _tts_service is None:
        _tts_service = TtsService(piper_bin=piper_bin, piper_model=piper_model)
    return _tts_service
