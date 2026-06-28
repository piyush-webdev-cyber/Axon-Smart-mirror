import { useCallback } from "react";
import { useAppStore } from "@/store";
import type { VoiceState } from "@/types/voice";
import type { VoicePhase } from "@/types/voiceSpeech";
import { nativeVoiceClient } from "@/features/voice/native/nativeVoiceClient";
import { triggerVoiceCancel, triggerVoiceWake } from "./voiceEngine";

interface VoiceController {
  state: VoiceState;
  phase: VoicePhase;
  micReady: boolean;
  wakeActive: boolean;
  wakePulse: boolean;
  listenPhrase: string;
  transcript: string;
  interimTranscript: string;
  transcriptFrozen: boolean;
  confidence: number | null;
  language: string;
  intentDebug: {
    intent: string;
    confidence: number;
    matchedPhrase: string;
  } | null;
  reply: string;
  statusLine: string;
  backendConnected: boolean;
  audioStreaming: boolean;
  needsAudioUnlock: boolean;
  debugVoice: boolean;
  press: () => void;
}

export function useVoiceController(): VoiceController {
  const state = useAppStore((s) => s.voiceState);
  const phase = useAppStore((s) => s.voicePhase);
  const micReady = useAppStore((s) => s.voiceMicReady);
  const wakeActive = useAppStore((s) => s.voiceWakeActive);
  const wakePulse = useAppStore((s) => s.voiceWakeDetectedPulse);
  const listenPhrase = useAppStore((s) => s.voiceListenPhrase);
  const transcript = useAppStore((s) => s.voiceTranscript);
  const interimTranscript = useAppStore((s) => s.voiceInterimTranscript);
  const transcriptFrozen = useAppStore((s) => s.voiceTranscriptFrozen);
  const confidence = useAppStore((s) => s.voiceConfidence);
  const language = useAppStore((s) => s.voiceLanguage);
  const intentDebug = useAppStore((s) => s.voiceIntentDebug);
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
    phase,
    micReady,
    wakeActive,
    wakePulse,
    listenPhrase,
    transcript,
    interimTranscript,
    transcriptFrozen,
    confidence,
    language,
    intentDebug,
    reply,
    statusLine,
    backendConnected,
    audioStreaming,
    needsAudioUnlock,
    debugVoice: import.meta.env.VITE_DEBUG_VOICE === "true",
    press,
  };
}
