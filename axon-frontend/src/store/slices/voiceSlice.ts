import type { StateCreator } from "zustand";
import type { VoiceEvent, VoiceState } from "@/types/voice";

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
  /** Live STT text shown under the mic. */
  voiceTranscript: string;
  /** Last assistant reply (spoken + displayed). */
  voiceReply: string;
  /** Dispatch an FSM event. No-op if the transition is not allowed. */
  dispatchVoiceEvent: (event: VoiceEvent) => void;
  setVoiceMicReady: (ready: boolean) => void;
  setVoiceWakeActive: (active: boolean) => void;
  setVoiceWakeDetectedPulse: (active: boolean) => void;
  setVoiceTranscript: (text: string) => void;
  setVoiceReply: (text: string) => void;
  resetVoice: () => void;
}

export const createVoiceSlice: StateCreator<VoiceSlice, [], [], VoiceSlice> = (
  set,
) => ({
  voiceState: "idle",
  voiceMicReady: false,
  voiceWakeActive: false,
  voiceWakeDetectedPulse: false,
  voiceTranscript: "",
  voiceReply: "",
  dispatchVoiceEvent: (event) =>
    set((state) => {
      const next = TRANSITIONS[state.voiceState][event];
      return next ? { voiceState: next } : state;
    }),
  setVoiceMicReady: (ready) => set({ voiceMicReady: ready }),
  setVoiceWakeActive: (active) => set({ voiceWakeActive: active }),
  setVoiceWakeDetectedPulse: (active) => set({ voiceWakeDetectedPulse: active }),
  setVoiceTranscript: (text) => set({ voiceTranscript: text }),
  setVoiceReply: (text) => set({ voiceReply: text }),
  resetVoice: () =>
    set({
      voiceState: "idle",
      voiceMicReady: false,
      voiceWakeActive: false,
      voiceWakeDetectedPulse: false,
      voiceTranscript: "",
      voiceReply: "",
    }),
});
