/**
 * Hands-free voice pipeline: always-on wake word → STT → backend → TTS → idle.
 * Mic button is manual fallback only.
 */

import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { WS_EVENTS } from "@/constants/wsEvents";
import { useAuth } from "@/context/AuthProvider";
import {
  executeIntent,
  isImmediateIntent,
  voiceActionToIntent,
} from "@/features/voice/intentDispatcher";
import { resolveVoiceCommand, type ResolvedVoiceCommand } from "@/features/voice/resolveVoiceCommand";
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
import { websocketClient } from "@/services/websocketClient";
import { useAppStore } from "@/store";
import type { VoiceAction, VoiceProcessResult } from "@/types/voiceAssistant";
import type { VoiceState } from "@/types/voice";
import type { NativeVoiceEvent } from "@/types/axonVoice";

import {
  dispatchSpeechEvent,
  setVoiceProcessingPhase,
  setVoiceReadyPhase,
  setVoiceIntentDebugInfo,
} from "@/features/voice/voiceSpeechBridge";
import { matchIntent } from "@/features/voice/intentEngine";
import { FINAL_TRANSCRIPT_FREEZE_MS } from "@/types/voiceSpeech";
import {
  stripWakeWordPrefix,
  WAKE_WORD,
} from "@/constants/voiceConfig";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

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
  const setInterimTranscript = useAppStore((s) => s.setVoiceInterimTranscript);
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
  const nativeSttFallbackRef = useRef(false);
  const forceBrowserManualRef = useRef(false);
  const manualCaptureTimerRef = useRef<number | null>(null);
  const freezeTokenRef = useRef(0);

  const clearManualCaptureTimer = useCallback(() => {
    if (manualCaptureTimerRef.current) {
      clearTimeout(manualCaptureTimerRef.current);
      manualCaptureTimerRef.current = null;
    }
  }, []);

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

  const pendingResolvedRef = useRef<ResolvedVoiceCommand | null>(null);

  const runImmediateAction = useCallback(
    (resolved: ResolvedVoiceCommand | null | undefined) => {
      if (!resolved) return;
      if (isImmediateIntent(resolved.intent)) {
        executeIntent(resolved.intent, navigate, resolved.payload);
      }
    },
    [navigate],
  );

  const finishSpeaking = useCallback(
    (resolved: ResolvedVoiceCommand | null | undefined) => {
      if (resolved && !isImmediateIntent(resolved.intent)) {
        executeIntent(resolved.intent, navigate, resolved.payload);
      }
      dispatch("done");
      emit(WS_EVENTS.voiceComplete, {});
      processingRef.current = false;
      setWakeActive(true);
      window.setTimeout(() => {
        const phrase = useAppStore.getState().voiceListenPhrase;
        setVoiceReadyPhase(phrase);
      }, 2000);
    },
    [dispatch, emit, navigate, setWakeActive],
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
    const useBackendMicOnly =
      nativeModeRef.current &&
      !nativeSttFallbackRef.current &&
      !forceBrowserManualRef.current &&
      nativeVoiceClient.isLocalMicActive();

    if (useBackendMicOnly) {
      micReadyRef.current = true;
      setMicReady(true);
      return true;
    }

    if (nativeModeRef.current && !forceBrowserManualRef.current && micReadyRef.current) {
      return true;
    }

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
    async (resolved: ResolvedVoiceCommand) => {
      const { result } = resolved;
      pendingResolvedRef.current = resolved;
      setReply(result.reply);
      dispatch("responseReady");
      emit(WS_EVENTS.voiceSpeaking, { reply: result.reply });

      runImmediateAction(resolved);

      try {
        await speak(result.reply);
      } catch {
        /* TTS failure should not block returning to idle */
      }

      finishSpeaking(resolved);
      pendingResolvedRef.current = null;
      if (!nativeModeRef.current) armWakeWord();
    },
    [armWakeWord, dispatch, emit, finishSpeaking, runImmediateAction, setReply],
  );

  const processTranscript = useCallback(
    async (raw: string) => {
      const transcript = cleanTranscript(raw);
      if (processingRef.current) return;

      if (!transcript) {
        if (voiceStateRef.current === "listening") {
          dispatchSpeechEvent({
            type: "speechError",
            code: "no-speech",
            message: "No speech detected.",
          });
          dispatch("cancel");
          armWakeWord();
        }
        return;
      }

      const freezeToken = ++freezeTokenRef.current;
      dispatchSpeechEvent({ type: "speechFinal", text: transcript, language: "en-US" });
      dispatchSpeechEvent({ type: "speechEnd" });

      await sleep(FINAL_TRANSCRIPT_FREEZE_MS);
      if (freezeToken !== freezeTokenRef.current || voiceStateRef.current !== "listening") {
        return;
      }

      processingRef.current = true;
      clearManualCaptureTimer();
      forceBrowserManualRef.current = false;
      if (!nativeModeRef.current) sttSession.stop();
      setVoiceProcessingPhase(transcript);
      emit(WS_EVENTS.voiceTranscript, { transcript });
      dispatch("stopListening");
      setWakeActive(false);

      const coords = coordsRef.current;
      const displayName = getDisplayName(user);

      try {
        emit(WS_EVENTS.voiceProcessing, { transcript });

        const resolved = await resolveVoiceCommand({
          transcript,
          ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
          ...(displayName ? { displayName } : {}),
        });

        emit(WS_EVENTS.voiceResponse, {
          reply: resolved.result.reply,
          action: resolved.result.action,
        });
        await handleResponse(resolved);
      } catch {
        playErrorSound();
        dispatch("error");
        dispatchSpeechEvent({
          type: "speechError",
          message: "Couldn't understand. Please try again.",
        });
        processingRef.current = false;
        armWakeWord();
      }
    },
    [armWakeWord, dispatch, emit, handleResponse, setWakeActive, user, clearManualCaptureTimer],
  );

  const beginListening = useCallback(
    async (fromWakeWord = false) => {
      if (voiceStateRef.current !== "idle" && !fromWakeWord) return;

      const useNativeCapture =
        nativeModeRef.current &&
        !nativeSttFallbackRef.current &&
        !forceBrowserManualRef.current;

      if (useNativeCapture) {
        const ready = await ensureMic();
        if (!ready) return;
        if (!nativeVoiceClient.isConnected()) {
          await nativeVoiceClient.start();
        }
        if (!fromWakeWord) {
          const coords = coordsRef.current;
          const displayName = getDisplayName(user);
          const started = await nativeVoiceClient.startSttCapture({
            ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
            ...(displayName ? { displayName } : {}),
            ...(user?.id ? { userId: user.id } : {}),
          });
          if (!started) {
            setStatusLine("Voice capture failed — tap the mic again");
            dispatch("cancel");
            return;
          }
          clearManualCaptureTimer();
          manualCaptureTimerRef.current = window.setTimeout(() => {
            if (voiceStateRef.current === "listening") {
              void nativeVoiceClient.stopSttCapture();
              window.setTimeout(() => {
                if (voiceStateRef.current === "listening") {
                  processingRef.current = false;
                  dispatch("cancel");
                  setStatusLine("Didn't catch that — tap the mic and speak again");
                  nativeVoiceClient.resetWake();
                }
              }, 2500);
            }
          }, 10000);
        }
        setWakeActive(false);
        setReply("");
        dispatchSpeechEvent({ type: "speechStarted", language: "en" });
        dispatch("startListening");
        emit(WS_EVENTS.voiceListening, { fromWakeWord });
        return;
      }

      forceBrowserManualRef.current = false;
      clearManualCaptureTimer();

      const ready = await ensureMic();
      if (!ready) return;

      if (!fromWakeWord) {
        wakeWordService.pause();
      }
      setWakeActive(false);
      setReply("");
      dispatchSpeechEvent({ type: "speechStarted", language: "en-US" });
      dispatch("startListening");
      emit(WS_EVENTS.voiceListening, { fromWakeWord });

      if (nativeModeRef.current && !fromWakeWord) {
        nativeVoiceClient.pauseWake();
      }

      sttSession.start(
        {
          onStart: () => dispatchSpeechEvent({ type: "speechStarted", language: "en-US" }),
          onInterim: (result) => {
            const cleaned = cleanTranscript(result.text) || result.text;
            dispatchSpeechEvent({
              type: "speechPartial",
              text: cleaned,
              ...(result.confidence != null ? { confidence: result.confidence } : {}),
              ...(result.language ? { language: result.language } : {}),
            });
          },
          onFinal: (result) => {
            const cleaned = cleanTranscript(result.text);
            if (cleaned) {
              dispatchSpeechEvent({
                type: "speechFinal",
                text: cleaned,
                ...(result.confidence != null ? { confidence: result.confidence } : {}),
                ...(result.language ? { language: result.language } : {}),
              });
            }
          },
          onError: (message) => {
            playErrorSound();
            if (message.includes("denied")) {
              micReadyRef.current = false;
              setMicReady(false);
            }
            dispatchSpeechEvent({
              type: "speechError",
              message,
              ...(message.includes("denied") ? { code: "not-allowed" } : {}),
            });
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
        { fromWakeWord, forceBrowser: true },
      );
    },
    [
      armWakeWord,
      clearManualCaptureTimer,
      dispatch,
      emit,
      ensureMic,
      processTranscript,
      setMicReady,
      setReply,
      setTranscript,
      setInterimTranscript,
      setWakeActive,
      setStatusLine,
      user,
    ],
  );

  const cancelActive = useCallback(() => {
    freezeTokenRef.current += 1;
    clearManualCaptureTimer();
    sttSession.stop();
    if (nativeModeRef.current) {
      void nativeVoiceClient.stopSttCapture();
      nativeVoiceClient.stopPlayback();
      nativeVoiceClient.resetWake();
    } else {
      stopSpeaking();
    }
    processingRef.current = false;
    forceBrowserManualRef.current = false;
    dispatch("cancel");
    setVoiceReadyPhase();
    armWakeWord();
  }, [armWakeWord, clearManualCaptureTimer, dispatch]);

  const manualWake = useCallback(() => {
    void nativeVoiceClient.unlockAudio();
    // Backend local mic owns the device on Windows — browser speech cannot run in parallel.
    const useBackendMic =
      nativeModeRef.current &&
      (nativeVoiceClient.isLocalMicActive() || nativeVoiceClient.isConnected());
    forceBrowserManualRef.current = !useBackendMic;
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
          setVoiceReadyPhase(useAppStore.getState().voiceListenPhrase);
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
          clearManualCaptureTimer();
          skipListeningSoundRef.current = true;
          setWakeActive(false);
          dispatchSpeechEvent({ type: "speechStarted", language: "en" });
          dispatch("startListening");
          emit(WS_EVENTS.voiceListening, { fromWakeWord: true });
          break;
        case "stt_interim": {
          const partial = typeof event.text === "string" ? event.text.trim() : "";
          if (partial) {
            dispatchSpeechEvent({
              type: "speechPartial",
              text: partial,
              language: "en",
            });
          }
          break;
        }
        case "stt_final": {
          const raw = typeof event.text === "string" ? event.text : "";
          if (raw) {
            dispatchSpeechEvent({ type: "speechFinal", text: raw, language: "en" });
          }
          break;
        }
        case "stt_end":
          if (voiceStateRef.current === "listening" && !processingRef.current) {
            const heard = useAppStore.getState().voiceTranscript.trim();
            if (!heard) {
              dispatchSpeechEvent({
                type: "speechError",
                code: "no-speech",
                message: "No speech detected.",
              });
              dispatch("cancel");
              processingRef.current = false;
              nativeVoiceClient.resetWake();
            }
          }
          break;
        case "processing_started":
          clearManualCaptureTimer();
          dispatch("stopListening");
          if (typeof event.transcript === "string" && event.transcript.trim()) {
            const transcript = event.transcript.trim();
            setVoiceProcessingPhase(transcript);
            const match = matchIntent(transcript);
            setVoiceIntentDebugInfo({
              intent: match.intent,
              confidence: match.confidence,
              matchedPhrase: match.matchedPhrase,
            });
          }
          emit(WS_EVENTS.voiceProcessing, { transcript: event.transcript ?? "" });
          processingRef.current = true;
          break;
        case "response_ready": {
          setReply(event.reply);
          setStatusLine("Speaking response…");
          const musicQuery =
            (typeof event.musicQuery === "string" ? event.musicQuery : null) ??
            (typeof (event as { music_query?: string }).music_query === "string"
              ? (event as { music_query?: string }).music_query
              : null);
          const result: VoiceProcessResult = {
            reply: event.reply,
            action: (event.action as VoiceAction | null | undefined) ?? null,
            ...(musicQuery != null ? { musicQuery } : {}),
            source: "offline",
          };
          const intent = voiceActionToIntent(result.action);
          const payload: ResolvedVoiceCommand["payload"] = {};
          if (musicQuery) payload.musicQuery = musicQuery;
          const resolved: ResolvedVoiceCommand = {
            intent,
            payload,
            result,
          };
          pendingResolvedRef.current = resolved;
          emit(WS_EVENTS.voiceResponse, { reply: event.reply, action: event.action });
          runImmediateAction(resolved);
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
          void nativeVoiceClient.waitForPlayback().then(() => {
            if (!processingRef.current) return;
            finishSpeaking(pendingResolvedRef.current);
            pendingResolvedRef.current = null;
          });
          break;
        }
        case "error": {
          const message = typeof event.message === "string" ? event.message : "Voice error";
          if (/stt engine unavailable|empty audio/i.test(message)) {
            nativeSttFallbackRef.current = true;
            nativeModeRef.current = false;
            setStatusLine("Using browser speech — tap mic and speak your command");
            setVoiceReadyPhase();
            processingRef.current = false;
            void ensureMic().then((ready) => {
              if (ready) void beginListening(false);
            });
            break;
          }
          playErrorSound();
          dispatch("error");
          setBackendConnected(nativeVoiceClient.isConnected());
          dispatchSpeechEvent({ type: "speechError", message });
          processingRef.current = false;
          break;
        }
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
        setVoiceReadyPhase(useAppStore.getState().voiceListenPhrase);
        setReply("");

        try {
          const { mirrorApiBase } = await import("@/utils/apiRouting");
          const controller = new AbortController();
          const timeout = window.setTimeout(() => controller.abort(), 4000);
          const statusRes = await fetch(`${mirrorApiBase()}/voice/status`, {
            signal: controller.signal,
          });
          window.clearTimeout(timeout);
          if (statusRes.ok) {
            const status = (await statusRes.json()) as { nativeStt?: boolean; native_stt?: boolean };
            if (!(status.nativeStt ?? status.native_stt)) {
              nativeSttFallbackRef.current = true;
              setStatusLine("Tap the mic to speak (browser speech recognition)");
            }
          } else {
            nativeSttFallbackRef.current = true;
          }
        } catch {
          nativeSttFallbackRef.current = true;
          setStatusLine("Tap the mic to speak your command");
        }

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
    setInterimTranscript,
    setWakeActive,
    setWakePulse,
    setListenPhrase,
    setStatusLine,
    setBackendConnected,
    setAudioStreaming,
    setNeedsAudioUnlock,
    ensureMic,
    beginListening,
    clearManualCaptureTimer,
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
        setVoiceReadyPhase(useAppStore.getState().voiceListenPhrase);
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
