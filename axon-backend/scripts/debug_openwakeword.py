#!/usr/bin/env python3
"""Standalone OpenWakeWord mic debug — no FastAPI, Electron, or WebSockets.

Usage (from axon-backend with venv active):
    python scripts/debug_openwakeword.py
    python scripts/debug_openwakeword.py --model models/hey_jarvis.onnx
    python scripts/debug_openwakeword.py --model hey_jarvis_v0.1 --threshold 0.2

Say "hey jarvis" clearly into the microphone. Expect scores >= 0.5 on a hit.
"""

from __future__ import annotations

import argparse
import importlib.metadata
import os
import sys
from pathlib import Path

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

SAMPLE_RATE = 16_000
CHUNK = 4096
DEBUG_THRESHOLDS = (0.001, 0.01, 0.05, 0.20, 0.50)


def _default_model() -> str:
    env_path = os.environ.get("AXON_WAKEWORD_MODEL_PATH", "").strip()
    if env_path and Path(env_path).is_file():
        return env_path
    return "hey_jarvis_v0.1"


def main() -> int:
    parser = argparse.ArgumentParser(description="Debug OpenWakeWord from microphone")
    parser.add_argument("--model", default=_default_model(), help="ONNX path or pretrained name")
    parser.add_argument("--threshold", type=float, default=0.20)
    parser.add_argument("--chunk", type=int, default=CHUNK)
    args = parser.parse_args()

    try:
        import sounddevice as sd
    except ImportError:
        print("ERROR: sounddevice not installed. pip install sounddevice")
        return 1

    try:
        import openwakeword
        from openwakeword.model import Model
        from openwakeword.utils import download_models
    except ImportError as exc:
        print(f"ERROR: openwakeword not installed: {exc}")
        return 1

    version = importlib.metadata.version("openwakeword")
    print(f"[DEBUG] OpenWakeWord version: {version}")
    print(f"[DEBUG] openwakeword package: {openwakeword.__file__}")

    model_arg = args.model
    if Path(model_arg).is_file():
        print(f"[DEBUG] Loading local model file: {model_arg}")
    else:
        print(f"[DEBUG] Loading pretrained model: {model_arg}")
        try:
            download_models(model_names=[model_arg.replace(".onnx", "")])
        except Exception as exc:  # noqa: BLE001
            print(f"[DEBUG] Asset download note: {exc}")

    oww = Model(wakeword_models=[model_arg], inference_framework="onnx")
    keys = list(oww.models.keys())
    print(f"[DEBUG] model.models.keys(): {keys}")
    for key, session in oww.models.items():
        path = getattr(session, "_model_path", None)
        print(f"[DEBUG] Model file: {path} -> prediction key '{key}'")

    device = sd.default.device[0]
    info = sd.query_devices(device, "input")
    print(f"[DEBUG] Mic device #{device}: {info.get('name', 'unknown')}")
    print(f"[DEBUG] sample_rate={SAMPLE_RATE} chunk={args.chunk} dtype=int16 threshold={args.threshold}")
    print("[DEBUG] Listening — say 'hey jarvis' ... (Ctrl+C to stop)\n")

    inference_count = 0

    def callback(indata, frames, _time, status) -> None:
        nonlocal inference_count
        if status:
            print(f"[DEBUG] stream status: {status}")

        mono = indata[:, 0] if indata.ndim > 1 else indata
        pcm = (np.clip(mono, -1.0, 1.0) * 32767.0).astype(np.int16)

        inference_count += 1
        n = inference_count
        rms = float(np.sqrt(np.mean((pcm.astype(np.float32) / 32768.0) ** 2)))

        if n <= 3 or n % 25 == 0:
            print(
                f"[DEBUG] PCM #{n} len={len(pcm)} min={pcm.min()} max={pcm.max()} "
                f"mean={pcm.mean():.1f} rms={rms:.6f}"
            )

        print("[DEBUG] Running OpenWakeWord inference...")
        scores = oww.predict(pcm)
        print("[DEBUG] Inference complete.")
        norm = {str(k): float(v) for k, v in scores.items()}
        print(f"[DEBUG] Prediction: {norm}")
        print(f"[DEBUG] Prediction keys: {list(scores.keys())}")

        peak = max(norm.values()) if norm else 0.0
        peak_key = max(norm, key=norm.get) if norm else ""
        probes = ", ".join(f"{t}={'HIT' if peak >= t else 'miss'}" for t in DEBUG_THRESHOLDS)
        print(f"[DEBUG] Threshold probe ({peak_key}={peak:.6f}): {probes}")

        if peak >= args.threshold:
            print(f"[WAKEWORD] Wake Word Detected — {peak_key}={peak:.4f}")
            oww.reset()

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype="float32",
        blocksize=args.chunk,
        callback=callback,
    ):
        try:
            while True:
                sd.sleep(1000)
        except KeyboardInterrupt:
            print("\n[DEBUG] Stopped.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
