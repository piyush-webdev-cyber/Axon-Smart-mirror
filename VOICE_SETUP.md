# Native Voice Setup (Electron)

Hands-free wake word **"Nexa"** uses a local FastAPI voice service on port **8010**.

## 1. Install Python voice dependencies

```powershell
cd axon-backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt -r requirements-voice.txt
python scripts/setup_voice.py
```

## 2. Configure `.env`

```env
AXON_WAKEWORD_MODEL_PATH=C:/path/to/axon-backend/models/nexa.onnx
AXON_WHISPER_MODEL=base.en
AXON_WHISPER_DEVICE=cpu
AXON_PIPER_BIN=C:/path/to/piper/piper.exe
AXON_PIPER_MODEL=C:/path/to/axon-backend/models/piper/en_US-lessac-medium.onnx
GEMINI_API_KEY=your-key
```

### Porcupine fallback (if OpenWakeWord model unavailable)

```env
AXON_WAKEWORD_ENGINE=porcupine
AXON_PORCUPINE_ACCESS_KEY=your-picovoice-key
AXON_PORCUPINE_KEYWORD_PATH=C:/path/to/nexa_windows.ppn
```

Create a custom **Nexa** keyword at [Picovoice Console](https://console.picovoice.ai/).

### Train OpenWakeWord "Nexa" model

```powershell
pip install openwakeword
python -m openwakeword.train --wakeword nexa --output_dir models
```

Copy the exported `nexa.onnx` to `axon-backend/models/nexa.onnx`.

## 3. Run Electron

```powershell
cd axon-electron
npm run dev
```

Electron auto-starts the voice backend. The mic button shows:

| State | Label |
|-------|-------|
| Idle | Say Nexa |
| Armed | Listening for Nexa |
| Wake | Wake word detected |
| Capture | Recording |
| Think | Processing... |
| Talk | Speaking... |

## 4. Verify logs

Backend terminal should show:

```
[WAKEWORD] Listening...
[WAKEWORD] Nexa detected
[STT] Recording started
[STT] Transcript received: ...
[AI] Response generated: ...
[TTS] Speaking response
[WAKEWORD] Listening...
```

## Manual backend (optional)

```powershell
cd axon-backend
.\.venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8010
```

Set `AXON_VOICE_AUTOSTART=0` in Electron if you start it manually.
