/**
 * Hands-free voice pipeline: always-on wake word → STT → backend → TTS → idle.
 * Mic button is manual fallback only.
 */

import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { WS_EVENTS } from "@/constants/wsEvents";
import { useAuth } from "@/context/AuthProvider";
import { executeVoiceResult } from "@/features/voice/commandActions";
import { isMusicVoiceAction } from "@/features/music/musicVoiceActions";
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
  const setListenPhrase = useAppStore((s) => s.setVoiceListenPhrase);
  const setStatusLine = useAppStore((s) => s.setVoiceStatusLine);
  const setBackendConnected = useAppStore((s) => s.setVoiceBackendConnected);
  const setAudioStreaming = useAppStore((s) => s.setVoiceAudioStreaming);
  const setNeedsAudioUnlock = useAppStore((s) => s.setVoiceNeedsAudioUnlock);

  const voiceStateRef = useRef<VoiceState>("idle");
  const coordsRef = useRef<{ lat: number; lon: number } | null>(null);
  const processingRef = useRef(false);
  const micReadyRef = useRef(false);
  const skipListeningSoundRef = useRef(false);
  const beginListeningRef = useRef<(fromWakeWord?: boolean) => Promise<void>>(
    async () => {},
  );
  const nativeModeRef = useRef(isNativeVoiceEngine());
  const pendingActionRef = useRef<VoiceProcessResult | null>(null);

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
    (result: VoiceProcessResult | null | undefined) => {
      if (!result?.action) return;
      const immediateActions: VoiceAction[] = [
        "take_photo",
        "open_camera",
        "open_gallery",
        "show_gallery_qr",
        "go_home",
        "delete_photo",
        "pause_music",
        "resume_music",
        "stop_music",
        "next_track",
        "previous_track",
        "volume_up",
        "volume_down",
        "mute_music",
        "unmute_music",
        "shuffle_music",
        "repeat_music",
      ];
      if (immediateActions.includes(result.action) || isMusicVoiceAction(result.action)) {
        executeVoiceResult(result, navigate);
      }
    },
    [navigate],
  );

  const finishSpeaking = useCallback(
    (result: VoiceProcessResult | null | undefined) => {
      if (result?.action) {
        const immediateActions: VoiceAction[] = [
          "take_photo",
          "open_camera",
          "open_gallery",
          "show_gallery_qr",
          "go_home",
          "delete_photo",
          "pause_music",
          "resume_music",
          "stop_music",
          "next_track",
          "previous_track",
          "volume_up",
          "volume_down",
          "mute_music",
          "unmute_music",
          "shuffle_music",
          "repeat_music",
        ];
        if (!immediateActions.includes(result.action) && !isMusicVoiceAction(result.action)) {
          executeVoiceResult(result, navigate);
        }
      }
      dispatch("done");
      emit(WS_EVENTS.voiceComplete, {});
      setTranscript("");
      processingRef.current = false;
      setWakeActive(true);
      if (nativeModeRef.current) {
        const phrase = useAppStore.getState().voiceListenPhrase;
        setStatusLine(`Listening for “${phrase}”`);
      }
    },
    [dispatch, emit, navigate, setTranscript, setWakeActive, setStatusLine],
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
    if (nativeModeRef.current && nativeVoiceClient.isLocalMicActive()) {
      micReadyRef.current = true;
      setMicReady(true);
      return true;
    }

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

      runImmediateAction(result);

      try {
        await speak(result.reply);
      } catch {
        /* TTS failure should not block returning to idle */
      }

      finishSpeaking(result);
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
        setStatusLine("Recording — speak your command now");
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
    if (nativeModeRef.current) {
      void nativeVoiceClient.resumeAudio().then(() => beginListening(false));
      return;
    }
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
      if ("listenPhrase" in event && typeof event.listenPhrase === "string") {
        setListenPhrase(event.listenPhrase);
      }

      switch (event.type) {
        case "status":
        case "wake_armed":
          setWakeActive(true);
          setWakePulse(false);
          setBackendConnected(true);
          setStatusLine(
            `Ready · say “${useAppStore.getState().voiceListenPhrase}” or tap the mic`,
          );
          break;
        case "wakeword_detected":
        case "wake_detected":
          void primeAudioContext();
          playWakeActivationSound();
          setWakePulse(true);
          setStatusLine("Wake word detected!");
          window.setTimeout(() => setWakePulse(false), 900);
          emit(WS_EVENTS.voiceWakeDetected, { wakeWord: WAKE_WORD });
          break;
        case "recording_started":
          skipListeningSoundRef.current = true;
          setWakeActive(false);
          setTranscript("");
          setStatusLine("Recording — speak your command now");
          dispatch("startListening");
          emit(WS_EVENTS.voiceListening, { fromWakeWord: true });
          break;
        case "stt_final": {
          const raw = typeof event.text === "string" ? event.text : "";
          if (raw) setTranscript(raw);
          break;
        }
        case "processing_started":
          dispatch("stopListening");
          if (typeof event.transcript === "string" && event.transcript.trim()) {
            setTranscript(event.transcript);
          }
          setStatusLine("Processing what you said…");
          emit(WS_EVENTS.voiceProcessing, { transcript: event.transcript ?? "" });
          processingRef.current = true;
          break;
        case "response_ready": {
          setReply(event.reply);
          setStatusLine("Speaking response…");
          pendingActionRef.current = {
            reply: event.reply,
            action: (event.action as VoiceAction | null | undefined) ?? null,
          };
          emit(WS_EVENTS.voiceResponse, { reply: event.reply, action: event.action });
          runImmediateAction(pendingActionRef.current);
          break;
        }
        case "speaking_started": {
          const text = typeof event.text === "string" ? event.text : "";
          if (voiceStateRef.current === "processing") {
            dispatch("responseReady");
          }
          emit(WS_EVENTS.voiceSpeaking, { reply: text });
          if (text) {
            void nativeVoiceClient.playText(text);
          }
          break;
        }
        case "listening_resumed": {
          const phrase =
            "listenPhrase" in event && typeof event.listenPhrase === "string"
              ? event.listenPhrase
              : useAppStore.getState().voiceListenPhrase;
          setListenPhrase(phrase);
          setWakeActive(true);
          setStatusLine(`Listening for “${phrase}”`);
          void nativeVoiceClient.waitForPlayback().then(() => {
            if (!processingRef.current) return;
            finishSpeaking(pendingActionRef.current);
            pendingActionRef.current = null;
            setTranscript("");
          });
          break;
        }
        case "error":
          playErrorSound();
          dispatch("error");
          setBackendConnected(nativeVoiceClient.isConnected());
          setStatusLine(typeof event.message === "string" ? event.message : "Voice error");
          setTranscript(typeof event.message === "string" ? event.message : "Voice error");
          processingRef.current = false;
          break;
        case "audio_streaming":
          setAudioStreaming(true);
          setNeedsAudioUnlock(false);
          break;
        case "audio_blocked":
          setAudioStreaming(false);
          setNeedsAudioUnlock(true);
          if (useAppStore.getState().voiceBackendConnected) {
            setStatusLine("Click anywhere once to enable wake word listening");
          }
          break;
        default:
          break;
      }
    };

    const unsub = nativeVoiceClient.subscribe(handleNativeEvent);

    let retryTimer: ReturnType<typeof setInterval> | null = null;
    let audioWatchTimer: ReturnType<typeof setInterval> | null = null;
    let cancelled = false;

    async function connectNativeVoice(): Promise<void> {
      if (cancelled) return;
      setBackendConnected(false);
      setStatusLine("Connecting to voice backend…");
      const ok = await nativeVoiceClient.start();
      if (ok) {
        micReadyRef.current = true;
        setMicReady(true);
        setWakeActive(true);
        setBackendConnected(true);
        const phrase = useAppStore.getState().voiceListenPhrase;
        setStatusLine(`Ready · say “${phrase}” or tap the mic`);
        setTranscript("");
        setReply("");
        await primeAudioContext();
        if (!nativeVoiceClient.isLocalMicActive()) {
          await nativeVoiceClient.resumeAudio();
        }
        if (retryTimer) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
        return;
      }
      setBackendConnected(false);
      setStatusLine("Voice backend unavailable — retrying…");
    }

    void connectNativeVoice();
    retryTimer = setInterval(() => {
      if (!nativeVoiceClient.isConnected()) {
        setBackendConnected(false);
        void connectNativeVoice();
      }
    }, 3000);

    audioWatchTimer = setInterval(() => {
      const streaming = nativeVoiceClient.isAudioStreaming();
      setAudioStreaming(streaming);
      setNeedsAudioUnlock(!streaming && nativeVoiceClient.isConnected());
    }, 1500);

    return () => {
      cancelled = true;
      if (retryTimer) clearInterval(retryTimer);
      if (audioWatchTimer) clearInterval(audioWatchTimer);
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
    setListenPhrase,
    setStatusLine,
    setBackendConnected,
    setAudioStreaming,
    setNeedsAudioUnlock,
  ]);

  /** Browser boot — Web Speech wake word. */
  useEffect(() => {
    if (isNativeVoiceEngine()) return;

    if (!isVoiceEngineAvailable()) {
      setStatusLine("Voice requires Chrome, Edge, or the Axon desktop app.");
      return;
    }

    setBackendConnected(true);

    let retryTimer: ReturnType<typeof setInterval> | null = null;

    async function boot(): Promise<void> {
      const granted = await ensureMic();
      if (granted) {
        setStatusLine(`Listening for “${WAKE_WORD}” — or tap the mic`);
        armWakeWord();
      } else {
        setStatusLine("Allow microphone access when prompted");
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
  }, [armWakeWord, ensureMic, setStatusLine, setBackendConnected]);
}
