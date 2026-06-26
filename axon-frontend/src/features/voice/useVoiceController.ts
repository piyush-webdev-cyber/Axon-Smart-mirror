import { useCallback } from "react";
import { useAppStore } from "@/store";
import type { VoiceState } from "@/types/voice";
import { nativeVoiceClient } from "@/features/voice/native/nativeVoiceClient";
import { triggerVoiceCancel, triggerVoiceWake } from "./voiceEngine";

interface VoiceController {
  state: VoiceState;
  micReady: boolean;
  wakeActive: boolean;
  wakePulse: boolean;
  listenPhrase: string;
  transcript: string;
  reply: string;
  statusLine: string;
  backendConnected: boolean;
  audioStreaming: boolean;
  needsAudioUnlock: boolean;
  /** Manual fallback only — wake word is primary. */
  press: () => void;
}

export function useVoiceController(): VoiceController {
  const state = useAppStore((s) => s.voiceState);
  const micReady = useAppStore((s) => s.voiceMicReady);
  const wakeActive = useAppStore((s) => s.voiceWakeActive);
  const wakePulse = useAppStore((s) => s.voiceWakeDetectedPulse);
  const listenPhrase = useAppStore((s) => s.voiceListenPhrase);
  const transcript = useAppStore((s) => s.voiceTranscript);
  const reply = useAppStore((s) => s.voiceReply);
  const statusLine = useAppStore((s) => s.voiceStatusLine);
  const backendConnected = useAppStore((s) => s.voiceBackendConnected);
  const audioStreaming = useAppStore((s) => s.voiceAudioStreaming);
  const needsAudioUnlock = useAppStore((s) => s.voiceNeedsAudioUnlock);

  const press = useCallback(() => {
    void nativeVoiceClient.unlockAudio();
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

  return {
    state,
    micReady,
    wakeActive,
    wakePulse,
    listenPhrase,
    transcript,
    reply,
    statusLine,
    backendConnected,
    audioStreaming,
    needsAudioUnlock,
    press,
  };
}
