import { useCallback } from "react";
import { useAppStore } from "@/store";
import type { VoiceState } from "@/types/voice";
import { triggerVoiceCancel, triggerVoiceWake } from "./voiceEngine";

interface VoiceController {
  state: VoiceState;
  micReady: boolean;
  wakeActive: boolean;
  transcript: string;
  reply: string;
  /** Manual fallback only — wake word is primary. */
  press: () => void;
}

export function useVoiceController(): VoiceController {
  const state = useAppStore((s) => s.voiceState);
  const micReady = useAppStore((s) => s.voiceMicReady);
  const wakeActive = useAppStore((s) => s.voiceWakeActive);
  const transcript = useAppStore((s) => s.voiceTranscript);
  const reply = useAppStore((s) => s.voiceReply);

  const press = useCallback(() => {
    switch (state) {
      case "idle":
        triggerVoiceWake();
        break;
      case "listening":
      case "processing":
      case "speaking":
        triggerVoiceCancel();
        break;
    }
  }, [state]);

  return { state, micReady, wakeActive, transcript, reply, press };
}
