import { useCallback } from "react";
import { useAppStore } from "@/store";
import type { VoiceState } from "@/types/voice";

interface VoiceController {
  state: VoiceState;
  /** Primary press action. Phase 1 only drives FSM transitions (no audio). */
  press: () => void;
}

/**
 * Bridges the mic button UI to the voice FSM in the store.
 *
 * Phase 1: a press simply advances the state machine so transitions and visuals
 * can be validated. Phase 3 replaces `press` with real wake-word / STT / TTS
 * pipelines that dispatch the same events (startListening, stopListening,
 * responseReady, done).
 */
export function useVoiceController(): VoiceController {
  const state = useAppStore((s) => s.voiceState);
  const dispatch = useAppStore((s) => s.dispatchVoiceEvent);

  const press = useCallback(() => {
    switch (state) {
      case "idle":
        dispatch("startListening");
        break;
      case "listening":
        dispatch("stopListening");
        break;
      case "processing":
        dispatch("responseReady");
        break;
      case "speaking":
        dispatch("done");
        break;
    }
  }, [state, dispatch]);

  return { state, press };
}
