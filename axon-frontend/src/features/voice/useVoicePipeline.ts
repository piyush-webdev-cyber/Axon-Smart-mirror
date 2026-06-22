/**
 * Hands-free voice pipeline: always-on wake word → STT → backend → TTS → idle.
 * Mic button is manual fallback only.
 */

import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { WS_EVENTS } from "@/constants/wsEvents";
import { useAuth } from "@/context/AuthProvider";
import { executeVoiceAction } from "@/features/voice/commandActions";
import {
  isMicGranted,
  isVoiceEngineAvailable,
  primeAudioContext,
  requestMicAccess,
} from "@/features/voice/micPermission";
import { nativeVoiceClient } from "@/features/voice/native/nativeVoiceClient";
import { isNativeVoiceEngine } from "@/features/voice/native/voiceEngineMode";
import { registerVoiceEngine } from "@/features/voice/voiceEngine";
import {
  playErrorSound,
  playVoiceStateSound,
  playWakeActivationSound,
} from "@/features/voice/voiceFeedback";
import { sttSession } from "@/features/voice/sttService";
import { speak, stopSpeaking } from "@/features/voice/ttsService";
import { wakeWordService } from "@/features/voice/wakeWordService";
import { processVoiceTranscript } from "@/services/voiceApi";
import { websocketClient } from "@/services/websocketClient";
import { useAppStore } from "@/store";
import type { VoiceAction, VoiceProcessResult } from "@/types/voiceAssistant";
import type { VoiceState } from "@/types/voice";
import type { NativeVoiceEvent } from "@/types/axonVoice";

import {
  stripWakeWordPrefix,
  WAKE_WORD,
} from "@/constants/voiceConfig";

function getDisplayName(user: User | null): string | undefined {
  const stored = localStorage.getItem("axon_display_name");
  if (stored) return stored;
  const meta = user?.user_metadata?.["full_name"];
  return typeof meta === "string" ? meta : undefined;
}

function cleanTranscript(raw: string): string {
  return stripWakeWordPrefix(raw);
}

async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  if (!navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 },
    );
  });
}

export function useVoicePipeline(): void {
  const navigate = useNavigate();
  const { user } = useAuth();

  const dispatch = useAppStore((s) => s.dispatchVoiceEvent);
  const setTranscript = useAppStore((s) => s.setVoiceTranscript);
  const setReply = useAppStore((s) => s.setVoiceReply);
  const setMicReady = useAppStore((s) => s.setVoiceMicReady);
  const setWakeActive = useAppStore((s) => s.setVoiceWakeActive);
  const setWakePulse = useAppStore((s) => s.setVoiceWakeDetectedPulse);

  const voiceStateRef = useRef<VoiceState>("idle");
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const processingRef = useRef(false);
  const micReadyRef = useRef(false);
  const skipListeningSoundRef = useRef(false);
  const beginListeningRef = useRef<(fromWakeWord?: boolean) => Promise<void>>(
    async () => {},
  );
  const nativeModeRef = useRef(isNativeVoiceEngine());
  const pendingActionRef = useRef<VoiceAction | null>(null);

  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      voiceStateRef.current = state.voiceState;
      if (state.voiceState !== prev.voiceState) {
        playVoiceStateSound(state.voiceState, prev.voiceState, {
          skipListening: skipListeningSoundRef.current,
        });
        if (state.voiceState === "listening") {
          skipListeningSoundRef.current = false;
        }
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    void getCoords().then((coords) => {
      coordsRef.current = coords;
    });
  }, []);

  const emit = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    websocketClient.send(type, payload);
  }, []);

  const runImmediateAction = useCallback(
    (action: VoiceAction | null | undefined) => {
      if (!action) return;
      const immediateActions: VoiceAction[] = [
        "take_photo",
        "open_camera",
        "open_gallery",
        "show_gallery_qr",
        "go_home",
        "delete_photo",
      ];
      if (immediateActions.includes(action)) {
        executeVoiceAction(action, navigate);
      }
    },
    [navigate],
  );

  const finishSpeaking = useCallback(
    (action: VoiceAction | null | undefined) => {
      if (action) {
        const immediateActions: VoiceAction[] = [
          "take_photo",
          "open_camera",
          "open_gallery",
          "show_gallery_qr",
          "go_home",
          "delete_photo",
        ];
        if (!immediateActions.includes(action)) {
          executeVoiceAction(action, navigate);
        }
      }
      dispatch("done");
      emit(WS_EVENTS.voiceComplete, {});
      setTranscript("");
      processingRef.current = false;
      setWakeActive(true);
    },
    [dispatch, emit, navigate, setTranscript, setWakeActive],
  );

  const armWakeWord = useCallback(() => {
    if (!isVoiceEngineAvailable() || !micReadyRef.current) return;

    if (nativeModeRef.current) {
      nativeVoiceClient.resetWake();
      setWakeActive(true);
      return;
    }

    if (wakeWordService.isArmed()) return;

    wakeWordService.start({
      onWakeDetected: () => {
        void primeAudioContext();
        playWakeActivationSound();
        setWakePulse(true);
        window.setTimeout(() => setWakePulse(false), 900);
        emit(WS_EVENTS.voiceWakeDetected, { wakeWord: WAKE_WORD });
        skipListeningSoundRef.current = true;
        void beginListeningRef.current(true);
      },
      onArmed: () => setWakeActive(true),
      onDisarmed: () => setWakeActive(false),
      onError: (message) => {
        setWakeActive(false);
        if (message.includes("denied")) {
          micReadyRef.current = false;
          setMicReady(false);
          setTranscript("Allow microphone access for hands-free wake word.");
        }
      },
    });
  }, [emit, setMicReady, setTranscript, setWakeActive, setWakePulse]);

  const ensureMic = useCallback(async (): Promise<boolean> => {
    if (nativeModeRef.current && micReadyRef.current) return true;

    if (micReadyRef.current || isMicGranted()) {
      micReadyRef.current = true;
      setMicReady(true);
      return true;
    }

    const granted = await requestMicAccess();
    if (!granted) {
      setTranscript("Allow microphone access for hands-free wake word.");
      return false;
    }

    micReadyRef.current = true;
    setMicReady(true);
    return true;
  }, [setMicReady, setTranscript]);

  const handleResponse = useCallback(
    async (result: VoiceProcessResult) => {
      setReply(result.reply);
      dispatch("responseReady");
      emit(WS_EVENTS.voiceSpeaking, { reply: result.reply });

      runImmediateAction(result.action);

      try {
        await speak(result.reply);
      } catch {
        /* TTS failure should not block returning to idle */
      }

      finishSpeaking(result.action);
      if (!nativeModeRef.current) armWakeWord();
    },
    [armWakeWord, dispatch, emit, finishSpeaking, runImmediateAction, setReply],
  );

  const processTranscript = useCallback(
    async (raw: string) => {
      const transcript = cleanTranscript(raw);
      if (processingRef.current || !transcript) {
        if (!transcript && voiceStateRef.current === "listening") {
          dispatch("cancel");
          armWakeWord();
        }
        return;
      }

      processingRef.current = true;
      if (!nativeModeRef.current) sttSession.stop();
      setTranscript(transcript);
      emit(WS_EVENTS.voiceTranscript, { transcript });
      dispatch("stopListening");
      setWakeActive(false);

      const coords = coordsRef.current;
      const displayName = getDisplayName(user);

      try {
        emit(WS_EVENTS.voiceProcessing, { transcript });

        const result = await processVoiceTranscript({
          transcript,
          ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
          ...(displayName ? { displayName } : {}),
        });

        emit(WS_EVENTS.voiceResponse, { reply: result.reply, action: result.action });
        await handleResponse(result);
      } catch {
        playErrorSound();
        dispatch("error");
        setTranscript("Sorry, I couldn't process that. Try again.");
        processingRef.current = false;
        armWakeWord();
      }
    },
    [armWakeWord, dispatch, emit, handleResponse, setTranscript, setWakeActive, user],
  );

  const beginListening = useCallback(
    async (fromWakeWord = false) => {
      if (voiceStateRef.current !== "idle" && !fromWakeWord) return;

      if (nativeModeRef.current) {
        const ready = await ensureMic();
        if (!ready) return;
        if (!fromWakeWord) {
          nativeVoiceClient.startSttCapture();
        }
        setWakeActive(false);
        setTranscript("");
        setReply("");
        dispatch("startListening");
        emit(WS_EVENTS.voiceListening, { fromWakeWord });
        return;
      }

      const ready = await ensureMic();
      if (!ready) return;

      if (!fromWakeWord) {
        wakeWordService.pause();
      }
      setWakeActive(false);
      setTranscript("");
      setReply("");
      dispatch("startListening");
      emit(WS_EVENTS.voiceListening, { fromWakeWord });

      sttSession.start(
        {
          onInterim: (text) => setTranscript(cleanTranscript(text) || text),
          onFinal: (text) => {
            const cleaned = cleanTranscript(text);
            if (cleaned) setTranscript(cleaned);
          },
          onError: (message) => {
            playErrorSound();
            if (message.includes("denied")) {
              micReadyRef.current = false;
              setMicReady(false);
            }
            dispatch("error");
            processingRef.current = false;
            armWakeWord();
          },
          onEnd: () => {
            const current = useAppStore.getState().voiceTranscript;
            if (voiceStateRef.current === "listening") {
              void processTranscript(current);
            }
          },
        },
        { fromWakeWord },
      );
    },
    [
      armWakeWord,
      dispatch,
      emit,
      ensureMic,
      processTranscript,
      setMicReady,
      setReply,
      setTranscript,
      setWakeActive,
    ],
  );

  const cancelActive = useCallback(() => {
    if (nativeModeRef.current) {
      nativeVoiceClient.stopSttCapture();
      nativeVoiceClient.stopPlayback();
    } else {
      sttSession.stop();
      stopSpeaking();
    }
    processingRef.current = false;
    dispatch("cancel");
    setTranscript("");
    armWakeWord();
  }, [armWakeWord, dispatch, setTranscript]);

  const manualWake = useCallback(() => {
    void beginListening(false);
  }, [beginListening]);

  useEffect(() => {
    beginListeningRef.current = beginListening;
  }, [beginListening]);

  useEffect(() => {
    registerVoiceEngine({
      wake: manualWake,
      cancel: cancelActive,
      unlock: ensureMic,
    });
    return () => registerVoiceEngine(null);
  }, [manualWake, cancelActive, ensureMic]);

  /** Native Electron pipeline — backend handles wake, STT, Gemini, and TTS. */
  useEffect(() => {
    if (!isNativeVoiceEngine()) return;

    nativeModeRef.current = true;

    const handleNativeEvent = (event: NativeVoiceEvent) => {
      switch (event.type) {
        case "wake_armed":
          setWakeActive(true);
          setWakePulse(false);
          break;
        case "wakeword_detected":
        case "wake_detected":
          void primeAudioContext();
          playWakeActivationSound();
          setWakePulse(true);
          window.setTimeout(() => setWakePulse(false), 900);
          emit(WS_EVENTS.voiceWakeDetected, { wakeWord: WAKE_WORD });
          break;
        case "recording_started":
          skipListeningSoundRef.current = true;
          setWakeActive(false);
          setTranscript("");
          dispatch("startListening");
          emit(WS_EVENTS.voiceListening, { fromWakeWord: true });
          break;
        case "stt_final": {
          const cleaned = cleanTranscript(event.text);
          if (cleaned) setTranscript(cleaned);
          break;
        }
        case "processing_started":
          dispatch("stopListening");
          emit(WS_EVENTS.voiceProcessing, { transcript: event.transcript ?? "" });
          processingRef.current = true;
          break;
        case "response_ready": {
          setReply(event.reply);
          pendingActionRef.current = (event.action as VoiceAction | null | undefined) ?? null;
          emit(WS_EVENTS.voiceResponse, { reply: event.reply, action: event.action });
          runImmediateAction(pendingActionRef.current);
          break;
        }
        case "speaking_started":
          if (voiceStateRef.current === "processing") {
            dispatch("responseReady");
          }
          emit(WS_EVENTS.voiceSpeaking, { reply: event.text });
          break;
        case "listening_resumed":
          finishSpeaking(pendingActionRef.current);
          pendingActionRef.current = null;
          break;
        case "error":
          playErrorSound();
          dispatch("error");
          setTranscript(event.message);
          processingRef.current = false;
          break;
        default:
          break;
      }
    };

    const unsub = nativeVoiceClient.subscribe(handleNativeEvent);

    void (async () => {
      const ok = await nativeVoiceClient.start();
      if (ok) {
        micReadyRef.current = true;
        setMicReady(true);
        setWakeActive(true);
      } else {
        setTranscript("Voice backend unavailable. Start the local FastAPI voice service.");
      }
    })();

    return () => {
      unsub();
      nativeVoiceClient.stop();
    };
  }, [
    dispatch,
    emit,
    finishSpeaking,
    runImmediateAction,
    setMicReady,
    setReply,
    setTranscript,
    setWakeActive,
    setWakePulse,
  ]);

  /** Browser boot — Web Speech wake word. */
  useEffect(() => {
    if (isNativeVoiceEngine()) return;

    if (!isVoiceEngineAvailable()) {
      setTranscript("Voice requires Chrome, Edge, or the Axon desktop app.");
      return;
    }

    let retryTimer: ReturnType<typeof setInterval> | null = null;

    async function boot(): Promise<void> {
      const granted = await ensureMic();
      if (granted) {
        armWakeWord();
      }
    }

    void boot();

    retryTimer = setInterval(() => {
      if (!micReadyRef.current) void boot();
    }, 12000);

    const onVisible = () => {
      if (document.visibilityState === "visible" && micReadyRef.current) {
        armWakeWord();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (retryTimer) clearInterval(retryTimer);
      document.removeEventListener("visibilitychange", onVisible);
      wakeWordService.stop();
    };
  }, [armWakeWord, ensureMic, setTranscript]);
}
