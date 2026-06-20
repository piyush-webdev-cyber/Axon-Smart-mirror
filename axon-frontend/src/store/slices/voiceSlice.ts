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
  /** Dispatch an FSM event. No-op if the transition is not allowed. */
  dispatchVoiceEvent: (event: VoiceEvent) => void;
  resetVoice: () => void;
}

export const createVoiceSlice: StateCreator<VoiceSlice, [], [], VoiceSlice> = (
  set,
) => ({
  voiceState: "idle",
  dispatchVoiceEvent: (event) =>
    set((state) => {
      const next = TRANSITIONS[state.voiceState][event];
      return next ? { voiceState: next } : state;
    }),
  resetVoice: () => set({ voiceState: "idle" }),
});
