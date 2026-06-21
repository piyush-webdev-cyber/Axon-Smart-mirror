# Axon Smart Mirror — Always-On Wake Word (Nexa)

## Overview

Wake word **"Nexa"** runs continuously on mirror boot. No mic button press is required.

The mic button remains a **manual fallback** only.

**Product name:** Axon Smart Mirror  
**Voice assistant:** Nexa  
**Wake word:** Nexa (configured in `axon-frontend/src/constants/voiceConfig.ts` and `axon-backend/app/core/voice_config.py`)

---

## Event Flow

```
Mirror boot
  → requestMicAccess() (browser permission prompt once)
  → WakeWordService armed (always-on)
  → Idle UI: "Say Nexa" / "Listening for Nexa"

User: "Nexa"
  → voice.wake_detected (WebSocket)
  → playWakeActivationSound() (<300ms)
  → voice.listening
  → STT captures command

User: "Open camera"
  → voice.transcript
  → voice.processing
  → Gemini / command router
  → voice.response
  → voice.speaking (TTS)
  → voice.complete
  → WakeWordService re-armed → Idle
```

---

## Files

| File | Role |
|------|------|
| `constants/voiceConfig.ts` | **Single source of truth** — `VOICE_ASSISTANT_NAME`, `WAKE_WORD`, UI labels |
| `core/voice_config.py` | Backend mirror of wake-word config |
| `wakeWordService.ts` | Always-on wake word engine (singleton) |
| `micPermission.ts` | Auto mic access on boot |
| `useVoicePipeline.ts` | Orchestrates wake → STT → AI → TTS |
| `voiceFeedback.ts` | Activation + state sounds |
| `MicButton.tsx` | Visual states (unchanged layout) |
| `wsEvents.ts` / `events.py` | `voice.wake_detected` + lifecycle events |

---

## Testing

### Desktop (Chrome / Edge)

1. Start backend + frontend
2. Open mirror — browser asks for **microphone permission** (one-time, not mic button)
3. Click **Allow**
4. Mic shows **Say Nexa** / **Listening for Nexa** with subtle pulse rings
5. Say: **"Nexa"** → activation chirp + blue glow + **Listening...**
6. Say: **"What time is it"** → spoken reply → returns to idle
7. Say: **"Nexa, open camera"** → navigates to camera

### Manual fallback

Tap mic while idle → starts listening without saying "Nexa"

### Raspberry Pi kiosk (recommended)

Launch Chromium with auto mic + audio:

```bash
chromium-browser \
  --kiosk http://127.0.0.1:5173 \
  --autoplay-policy=no-user-gesture-required \
  --use-fake-ui-for-media-stream
```

This enables fully hands-free wake word with no permission dialog.

---

## Performance (Pi)

- Wake word uses **Web Speech API** in short continuous sessions with auto-restart (low CPU vs always-streaming to cloud)
- **No audio sent to Gemini** until after wake word + command captured
- STT session runs only during active listening (~8s max)
- Wake cooldown: 2s between triggers (prevents double-fire)

### Future upgrade path

Replace `WakeWordService` internals with **Porcupine WASM** for fully offline wake word on Pi (same event interface, no pipeline changes).
