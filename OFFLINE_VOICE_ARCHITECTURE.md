# Offline Voice Command Architecture

Mirror voice controls **never require Gemini**. All predefined commands are parsed locally and dispatched to feature modules.

## Pipeline

```
Wake Word ("Hey Jarvis" / "Axon")
        ↓
Speech-to-Text (Faster-Whisper in Electron, Web Speech in browser)
        ↓
Offline Intent Engine
        ↓
Command Dispatcher (executeIntent)
        ↓
Feature Module (camera, gallery, music, weather, auth, …)
```

Unknown utterances return **"I didn't understand that command."** — Gemini is **not** called automatically.

## Frontend modules

| File | Role |
|------|------|
| `intentEngine.ts` | Normalize text, match synonyms → `MirrorIntent` |
| `intentDispatcher.ts` | **`executeIntent()`** — only entry point to features |
| `resolveVoiceCommand.ts` | Build spoken reply + action (incl. weather fetch) |
| `useVoicePipeline.ts` | Wake → STT → resolve → dispatch → TTS |
| `voiceLogger.ts` | Structured console logs |

## Backend modules (Electron native STT path)

| File | Role |
|------|------|
| `offline_intent_engine.py` | Python mirror of phrase rules |
| `voice_service.py` | Offline-only router (Gemini disabled) |
| `voice_pipeline.py` | Wake → STT → `process_voice_command` → TTS |

## Supported intents

`TAKE_PHOTO`, `OPEN_CAMERA`, `SHOW_MY_PHOTOS`, `PLAY_MUSIC`, `PLAY_SPECIFIC_SONG`, `PAUSE_MUSIC`, `SHOW_TIME`, `SHOW_DATE`, `SHOW_WEATHER`, `LOGOUT`, and all other mirror controls listed in `MirrorIntent` enum.

## Testing

```powershell
# Frontend intent unit tests
cd axon-frontend
npm run test

# Backend offline intent tests
cd axon-backend
python -m pytest tests/test_offline_intents.py -q
```

## Manual verification (Electron)

```powershell
cd axon-electron
npm run dev
```

1. Tap mic → say **"what time is it"** → spoken reply, no network AI call
2. Say **"take a photo"** → camera opens + capture
3. Say **"play Believer"** → music page + YouTube search
4. Say **"what is artificial intelligence"** → *"I didn't understand that command."*

## Future: Gemini

Gemini integration remains in `app/ai/gemini.py` for **future** general Q&A only. It is not invoked by `voice_service.py` for mirror controls.
