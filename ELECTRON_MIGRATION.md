# Electron Desktop Migration — Axon Smart Mirror

This guide converts the existing React + FastAPI mirror into an Electron kiosk app with **always-on local wake-word detection** (`Nexa`), while keeping the browser deployment on Vercel unchanged.

## Architecture

```
Electron (axon-electron)
├── React UI (axon-frontend) — unchanged routes/components
├── Preload IPC (axonShell, axonVoice)
└── Mic capture → WebSocket PCM → FastAPI

FastAPI (axon-backend)
├── OpenWakeWord   → wakeword_service.py
├── Faster-Whisper → stt_service.py
├── Piper TTS      → tts_service.py
├── /voice/process → Gemini (unchanged)
└── /voice/desktop/ws → streaming native pipeline
```

**Browser (Vercel):** still uses Web Speech API via the same React voice services (automatic fallback).

**Electron:** sets `window.axonVoice.isNativeEngine()` → adapters in `src/features/voice/native/` route audio through FastAPI ML stack.

---

## New files

| Path | Purpose |
|------|---------|
| `axon-electron/package.json` | Electron app + electron-builder |
| `axon-electron/electron/main.js` | Main process (window, kiosk, auto-launch) |
| `axon-electron/electron/preload.js` | Secure IPC bridge |
| `axon-backend/app/services/wakeword_service.py` | OpenWakeWord |
| `axon-backend/app/services/stt_service.py` | Faster-Whisper |
| `axon-backend/app/services/tts_service.py` | Piper TTS |
| `axon-backend/app/services/voice_desktop_session.py` | WS session FSM |
| `axon-backend/app/api/routes/voice_desktop.py` | `/voice/desktop/ws`, `/voice/tts` |
| `axon-backend/requirements-voice.txt` | Optional ML dependencies |
| `axon-frontend/src/features/voice/native/*` | Native voice adapters |
| `axon-frontend/src/types/axonVoice.d.ts` | Electron API types |

## Modified files

| Path | Change |
|------|--------|
| `axon-frontend/src/features/voice/wakeWordService.ts` | Delegates to native adapter in Electron |
| `axon-frontend/src/features/voice/sttService.ts` | Native STT path |
| `axon-frontend/src/features/voice/ttsService.ts` | Piper playback in Electron |
| `axon-frontend/src/features/voice/useVoicePipeline.ts` | Native boot + wake pulse |
| `axon-frontend/src/features/voice/MicButton.tsx` | Status labels + wake animation |
| `axon-frontend/vite.config.ts` | `base: './'` for packaged Electron |
| `axon-backend/app/api/routes/voice.py` | Engine status in `/voice/status` |
| `axon-backend/app/core/config.py` | Voice env vars |

---

## Installation (Windows dev)

### 1. Backend — base + voice extras

```powershell
cd axon-backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-voice.txt
```

### 2. Voice models

**Wake word (Nexa):** train or export an OpenWakeWord ONNX model and set:

```env
AXON_WAKEWORD_MODEL_PATH=C:\path\to\nexa.onnx
```

Without a custom model, OpenWakeWord loads bundled models for **pipeline testing only** (not “Nexa”).

**Whisper STT** (default `base.en`):

```env
AXON_WHISPER_MODEL=base.en
AXON_WHISPER_DEVICE=cpu
```

**Piper TTS:** download [Piper release](https://github.com/rhasspy/piper/releases) + a voice model:

```env
AXON_PIPER_BIN=C:\tools\piper\piper.exe
AXON_PIPER_MODEL=C:\tools\piper\en_US-lessac-medium.onnx
```

### 3. Start backend

```powershell
uvicorn app.main:app --reload --port 8010
```

Verify: `GET http://127.0.0.1:8010/api/v1/voice/status`

### 4. Frontend + Electron

```powershell
cd axon-electron
npm install
npm run dev
```

This starts Vite (`:5173`) and Electron loading the dev URL with native voice enabled.

### 5. Production desktop build

```powershell
cd axon-electron
npm run dist:win
```

Output: `axon-electron/release/`

---

## Environment variables

### Backend (`.env`)

```env
AXON_WAKEWORD_MODEL_PATH=
AXON_WHISPER_MODEL=base.en
AXON_WHISPER_DEVICE=cpu
AXON_PIPER_BIN=
AXON_PIPER_MODEL=
```

Add `http://127.0.0.1:5173` to `AXON_CORS_ORIGINS` (already default).

### Electron

| Variable | Default | Description |
|----------|---------|-------------|
| `AXON_VOICE_BACKEND_URL` | `http://127.0.0.1:8010` | FastAPI voice backend |
| `AXON_ELECTRON_DEV` | `1` in dev script | Dev mode |
| `AXON_DEV_URL` | `http://127.0.0.1:5173` | Vite dev server |

Kiosk and auto-launch are stored via `electron-store` and exposed on `window.axonShell`.

---

## Voice pipeline flow

1. **Idle** — PCM streamed to `/voice/desktop/ws`; OpenWakeWord scans for **Nexa**
2. **Wake detected** — UI pulse + auto `listening` state; backend captures command audio
3. **STT** — Faster-Whisper transcribes on silence / timeout
4. **Process** — existing `POST /voice/process` → Gemini (unchanged)
5. **TTS** — `POST /voice/tts` → Piper WAV → speaker
6. **Return** — `reset` control → wake-word listening resumes

Manual mic button remains as fallback (`start_stt` control path).

---

## API (backward compatible)

| Endpoint | Status |
|----------|--------|
| `GET /voice/status` | Extended with `nativeWakeword`, `nativeStt`, `nativeTts` |
| `POST /voice/process` | **Unchanged** |
| `WS /voice/desktop/ws` | **New** — Electron native pipeline |
| `POST /voice/tts` | **New** — Piper synthesis |

---

## Raspberry Pi deployment (later)

1. Build frontend: `npm run build:electron` in `axon-frontend`
2. Install `axon-electron` deps on Pi (ARM builds of onnxruntime + faster-whisper)
3. Run FastAPI as systemd service with voice extras
4. Launch Electron in kiosk: `axon-shell:setKiosk(true)`
5. Enable auto-launch: `window.axonShell.setAutoLaunch(true)`

Target: Pi 4/5 with USB mic; use `tiny.en` or `base.en` Whisper model for latency.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| “Voice pipeline connection failed” | Backend not running on `8010` or WS blocked |
| Wake word never fires | Install `requirements-voice.txt`; set `AXON_WAKEWORD_MODEL_PATH` |
| STT empty | Check mic levels; ensure Faster-Whisper model downloaded |
| TTS silent | Set `AXON_PIPER_BIN` + `AXON_PIPER_MODEL`; browser falls back to Web Speech on web |
| Browser on Vercel broken | Native path only activates when `window.axonVoice` exists |

---

## Migration checklist

- [ ] Install voice Python deps on mirror host
- [ ] Train / deploy Nexa OpenWakeWord ONNX model
- [ ] Configure Piper binary + voice
- [ ] Run backend locally on mirror (`8010`)
- [ ] `npm run dev` in `axon-electron` for smoke test
- [ ] Package with `npm run dist:win` or `dist:linux`
- [ ] Keep Vercel + Railway deployments for phone/gallery (unchanged)
