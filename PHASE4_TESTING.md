# Phase 4 — Voice Assistant Testing

## Prerequisites

1. **Backend** running on port `8010`:
   ```bash
   cd axon-backend
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload
   ```

2. **Frontend** running:
   ```bash
   cd axon-frontend
   npm run dev
   ```

3. **Environment**
   - `GEMINI_API_KEY` in `axon-backend/.env` (for open-ended questions)
   - Microphone permission allowed for `localhost:5173`
   - Location permission allowed (for weather voice command)

4. **Browser**: Chromium-based (Chrome / Edge / Pi kiosk). Web Speech API required.

---

## Architecture Overview

| Layer | Implementation |
|-------|----------------|
| Wake word | Local `"Nexa"` detection via lightweight SpeechRecognition bursts |
| STT | Web Speech API (browser) |
| AI | Gemini 1.5 Flash via backend (`/api/v1/voice/process`) |
| Command router | Fast local handlers + Gemini fallback |
| TTS | Browser `speechSynthesis` |
| Transport | REST + WebSocket lifecycle events |

**Config:** `VOICE_ASSISTANT_NAME` / `WAKE_WORD` in `voiceConfig.ts` (frontend) and `voice_config.py` (backend).

### WebSocket events

- `voice.wake` — wake word detected
- `voice.listening` — STT session active
- `voice.transcript` — final user text
- `voice.processing` — backend working
- `voice.response` — `{ reply, action }`
- `voice.speaking` — TTS started
- `voice.complete` — session finished
- `voice.process` — inbound process request (WS alternative to REST)

---

## Manual Test Flow

### 1. Wake word + conversation

1. Open mirror home (`http://localhost:5173`)
2. Wait for idle mic label: **Say Nexa** or **Listening for Nexa**
3. Say clearly: **"Nexa"**
4. Mic should show **Listening...**
5. Say: **"What's the weather today?"**
6. Expect:
   - Transcript shown under mic
   - **Thinking...** state
   - Spoken reply with live weather (if location allowed)
   - **Speaking...** waveform animation

### 2. Built-in commands (no Gemini latency)

| Say | Expected |
|-----|----------|
| "Nexa, what time is it?" | Speaks current time |
| "Nexa, open camera" | Speaks + navigates to `/camera` |
| "Nexa, open gallery" | Speaks + navigates to `/gallery` |
| "Nexa, go home" | Speaks + navigates to `/` |
| "Nexa, who am I?" | Speaks name if linked/signed in |

### 3. Manual mic fallback

- Tap mic while idle → starts listening (same as wake word)
- Tap mic while listening/thinking/speaking → cancels session

### 4. API smoke test

```bash
curl -X POST http://127.0.0.1:8010/api/v1/voice/process \
  -H "Content-Type: application/json" \
  -d "{\"transcript\": \"Nexa, what time is it\"}"
```

Expected: `200` with `{ "reply": "It's ...", "action": null }`

### 5. WebSocket test

Use browser devtools → Network → WS → send:

```json
{ "type": "voice.process", "payload": { "transcript": "open camera" } }
```

Expected inbound messages: `voice.processing`, `voice.response`, (client handles TTS locally)

---

## Raspberry Pi Notes

- Use Chromium kiosk mode with microphone enabled
- Web Speech STT/TTS uses Google cloud on Chromium — ensure network access
- Wake word detector pauses between sessions to reduce CPU
- For fully offline wake word, integrate Porcupine WASM in a future patch (`VITE_PICOVOICE_ACCESS_KEY`)

---

## Extending Actions

Add commands in `axon-backend/app/services/voice_service.py` and mirror actions in:

- `axon-frontend/src/features/voice/commandActions.ts`
- `axon-frontend/src/types/voiceAssistant.ts`

Future modules (InterviewGPT, Music, Face) plug into the same `{ reply, action }` contract.
