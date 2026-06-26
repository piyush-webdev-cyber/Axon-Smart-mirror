#!/usr/bin/env python3
"""Download Piper voice assets and verify native voice dependencies."""

from __future__ import annotations

import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"
PIPER_DIR = MODELS / "piper"
PIPER_VOICE_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx"
)
PIPER_JSON_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json"
)


def main() -> int:
    MODELS.mkdir(parents=True, exist_ok=True)
    PIPER_DIR.mkdir(parents=True, exist_ok=True)

    voice_path = PIPER_DIR / "en_US-lessac-medium.onnx"
    json_path = PIPER_DIR / "en_US-lessac-medium.onnx.json"

    for url, dest in ((PIPER_VOICE_URL, voice_path), (PIPER_JSON_URL, json_path)):
        if dest.is_file():
            print(f"[setup] Already present: {dest.name}")
            continue
        print(f"[setup] Downloading {dest.name}...")
        urllib.request.urlretrieve(url, dest)

    piper_bin = shutil.which("piper")
    if not piper_bin:
        print(
            "[setup] Piper binary not found in PATH.\n"
            "        Download from https://github.com/rhasspy/piper/releases\n"
            "        and set AXON_PIPER_BIN in axon-backend/.env",
        )
    else:
        print(f"[setup] Piper binary: {piper_bin}")

    nexa_model = MODELS / "nexa.onnx"
    if not nexa_model.is_file():
        print(
            "[setup] Nexa wake-word model missing at models/nexa.onnx\n"
            "        Train with OpenWakeWord (see VOICE_SETUP.md) or configure Porcupine:\n"
            "        AXON_PORCUPINE_ACCESS_KEY + AXON_PORCUPINE_KEYWORD_PATH",
        )
    else:
        print(f"[setup] Nexa wake model: {nexa_model}")

    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", "requirements-voice.txt"],
            cwd=ROOT,
            check=False,
        )
        from openwakeword.utils import download_models

        print("[setup] Downloading OpenWakeWord assets (melspectrogram, hey_jarvis)...")
        download_models(model_names=["hey_jarvis_v0.1"])
    except Exception as exc:  # noqa: BLE001
        print(f"[setup] OpenWakeWord download warning: {exc}")

    print(
        "\n[setup] Add to axon-backend/.env:\n"
        f"AXON_WAKEWORD_MODEL_PATH={nexa_model}\n"
        f"AXON_PIPER_MODEL={voice_path}\n"
        "AXON_PIPER_BIN=<path-to-piper.exe>\n",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
