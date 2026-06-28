import type { StateCreator } from "zustand";
import type { VoiceEvent, VoiceState } from "@/types/voice";
import type { VoiceIntentDebug, VoicePhase } from "@/types/voiceSpeech";

/**
 * Explicit finite-state machine for the mic button. Transitions are validated
 * against this map so illegal jumps are impossible. Phase 3 dispatches the same
 * events from real audio pipelines.
 */
const TRANSITIONS: Record<VoiceState, Partial<Record<VoiceEvent, VoiceState>>> =
  {
    idle: { startListening: "listening" },
    listening: { stopListening: "processing", cancel: "idle" },
    processing: { responseReady: "speaking", error: "idle", cancel: "idle" },
    speaking: { done: "idle", cancel: "idle" },
  };

export interface VoiceSlice {
  voiceState: VoiceState;
  /** Microphone unlocked via user gesture. */
  voiceMicReady: boolean;
  /** Wake-word listener is actively running. */
  voiceWakeActive: boolean;
  /** Pulse UI when wake word was just detected. */
  voiceWakeDetectedPulse: boolean;
  /** Phrase to speak for wake word (e.g. "hey jarvis"). */
  voiceListenPhrase: string;
  /** Final heard command (after STT completes). */
  voiceTranscript: string;
  /** Live partial STT while the user is still speaking. */
  voiceInterimTranscript: string;
  /** User-facing voice phase (independent of mic FSM). */
  voicePhase: VoicePhase;
  /** STT confidence score 0–1 when available. */
  voiceConfidence: number | null;
  /** BCP-47 language tag from the speech engine. */
  voiceLanguage: string;
  /** Final transcript is held visible before intent runs. */
  voiceTranscriptFrozen: boolean;
  /** Intent debug overlay (DEBUG_VOICE only). */
  voiceIntentDebug: VoiceIntentDebug | null;
  /** Last assistant reply (spoken + displayed). */
  voiceReply: string;
  /** System status line (connection, mode, errors). */
  voiceStatusLine: string;
  /** Native voice WebSocket connected. */
  voiceBackendConnected: boolean;
  /** Mic PCM is actively streaming to the backend (required for wake word). */
  voiceAudioStreaming: boolean;
  /** User must interact once to unlock browser/Electron audio capture. */
  voiceNeedsAudioUnlock: boolean;
  /** Dispatch an FSM event. No-op if the transition is not allowed. */
  dispatchVoiceEvent: (event: VoiceEvent) => void;
  setVoiceMicReady: (ready: boolean) => void;
  setVoiceWakeActive: (active: boolean) => void;
  setVoiceWakeDetectedPulse: (active: boolean) => void;
  setVoiceListenPhrase: (phrase: string) => void;
  setVoiceTranscript: (text: string) => void;
  setVoiceInterimTranscript: (text: string) => void;
  setVoicePhase: (phase: VoicePhase) => void;
  setVoiceConfidence: (score: number | null) => void;
  setVoiceLanguage: (language: string) => void;
  setVoiceTranscriptFrozen: (frozen: boolean) => void;
  setVoiceIntentDebug: (debug: VoiceIntentDebug | null) => void;
  setVoiceReply: (text: string) => void;
  setVoiceStatusLine: (line: string) => void;
  setVoiceBackendConnected: (connected: boolean) => void;
  setVoiceAudioStreaming: (streaming: boolean) => void;
  setVoiceNeedsAudioUnlock: (needs: boolean) => void;
  resetVoice: () => void;
}

export const createVoiceSlice: StateCreator<VoiceSlice, [], [], VoiceSlice> = (
  set,
) => ({
  voiceState: "idle",
  voiceMicReady: false,
  voiceWakeActive: false,
  voiceWakeDetectedPulse: false,
  voiceListenPhrase: "hey jarvis",
  voiceTranscript: "",
  voiceInterimTranscript: "",
  voicePhase: "ready",
  voiceConfidence: null,
  voiceLanguage: "en-US",
  voiceTranscriptFrozen: false,
  voiceIntentDebug: null,
  voiceReply: "",
  voiceStatusLine: "Starting voice…",
  voiceBackendConnected: false,
  voiceAudioStreaming: false,
  voiceNeedsAudioUnlock: true,
  dispatchVoiceEvent: (event) =>
    set((state) => {
      const next = TRANSITIONS[state.voiceState][event];
      return next ? { voiceState: next } : state;
    }),
  setVoiceMicReady: (ready) => set({ voiceMicReady: ready }),
  setVoiceWakeActive: (active) => set({ voiceWakeActive: active }),
  setVoiceWakeDetectedPulse: (active) => set({ voiceWakeDetectedPulse: active }),
  setVoiceListenPhrase: (phrase) => set({ voiceListenPhrase: phrase }),
  setVoiceTranscript: (text) => set({ voiceTranscript: text }),
  setVoiceInterimTranscript: (text) => set({ voiceInterimTranscript: text }),
  setVoicePhase: (phase) => set({ voicePhase: phase }),
  setVoiceConfidence: (score) => set({ voiceConfidence: score }),
  setVoiceLanguage: (language) => set({ voiceLanguage: language }),
  setVoiceTranscriptFrozen: (frozen) => set({ voiceTranscriptFrozen: frozen }),
  setVoiceIntentDebug: (debug) => set({ voiceIntentDebug: debug }),
  setVoiceReply: (text) => set({ voiceReply: text }),
  setVoiceStatusLine: (line) => set({ voiceStatusLine: line }),
  setVoiceBackendConnected: (connected) => set({ voiceBackendConnected: connected }),
  setVoiceAudioStreaming: (streaming) => set({ voiceAudioStreaming: streaming }),
  setVoiceNeedsAudioUnlock: (needs) => set({ voiceNeedsAudioUnlock: needs }),
  resetVoice: () =>
    set({
      voiceState: "idle",
      voiceMicReady: false,
      voiceWakeActive: false,
      voiceWakeDetectedPulse: false,
      voiceListenPhrase: "hey jarvis",
      voiceTranscript: "",
      voiceInterimTranscript: "",
      voicePhase: "ready",
      voiceConfidence: null,
      voiceLanguage: "en-US",
      voiceTranscriptFrozen: false,
      voiceIntentDebug: null,
      voiceReply: "",
      voiceStatusLine: "Starting voice…",
      voiceBackendConnected: false,
      voiceAudioStreaming: false,
      voiceNeedsAudioUnlock: true,
    }),
});
