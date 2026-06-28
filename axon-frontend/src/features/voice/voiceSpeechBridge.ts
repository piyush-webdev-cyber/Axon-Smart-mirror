/**
 * Maps engine-specific STT signals into generic speech events and store updates.
 * Skips redundant state writes to keep transcript rendering smooth.
 */

import { useAppStore } from "@/store";
import { formatVoicePhaseLabel } from "@/features/voice/voiceStatusMessages";
import type { VoiceIntentDebug, VoiceSpeechEvent } from "@/types/voiceSpeech";

export function dispatchSpeechEvent(event: VoiceSpeechEvent): void {
  const store = useAppStore.getState();
  const phrase = store.voiceListenPhrase;

  switch (event.type) {
    case "speechStarted":
      store.setVoiceInterimTranscript("");
      store.setVoiceTranscript("");
      store.setVoiceTranscriptFrozen(false);
      store.setVoiceIntentDebug(null);
      if (event.language) store.setVoiceLanguage(event.language);
      store.setVoicePhase("listening");
      store.setVoiceStatusLine(formatVoicePhaseLabel("listening", phrase));
      break;

    case "speechPartial": {
      const text = event.text.trim();
      if (!text || text === store.voiceInterimTranscript) return;
      store.setVoiceInterimTranscript(text);
      if (event.confidence != null) store.setVoiceConfidence(event.confidence);
      if (event.language) store.setVoiceLanguage(event.language);
      if (store.voicePhase !== "recognizing") {
        store.setVoicePhase("recognizing");
        store.setVoiceStatusLine(formatVoicePhaseLabel("recognizing", phrase));
      }
      break;
    }

    case "speechFinal": {
      const text = event.text.trim();
      if (!text) return;
      store.setVoiceInterimTranscript("");
      if (text !== store.voiceTranscript) {
        store.setVoiceTranscript(text);
      }
      store.setVoiceTranscriptFrozen(true);
      if (event.confidence != null) store.setVoiceConfidence(event.confidence);
      if (event.language) store.setVoiceLanguage(event.language);
      break;
    }

    case "speechError":
      store.setVoicePhase("error");
      store.setVoiceTranscriptFrozen(false);
      store.setVoiceStatusLine(
        event.code === "not-allowed"
          ? "🎤 Microphone permission required."
          : event.code === "no-speech"
            ? "No speech detected."
            : event.message || "Couldn't understand. Please try again.",
      );
      break;

    case "speechEnd":
      break;
  }
}

export function setVoiceProcessingPhase(transcript?: string): void {
  const store = useAppStore.getState();
  store.setVoiceInterimTranscript("");
  store.setVoiceTranscriptFrozen(true);
  if (transcript?.trim()) store.setVoiceTranscript(transcript.trim());
  store.setVoicePhase("processing");
  store.setVoiceStatusLine(formatVoicePhaseLabel("processing", store.voiceListenPhrase));
}

export function setVoiceExecutingPhase(intent: string, statusLine: string): void {
  const store = useAppStore.getState();
  store.setVoicePhase("executing");
  store.setVoiceStatusLine(statusLine);
  if (import.meta.env.VITE_DEBUG_VOICE === "true") {
    const debug = store.voiceIntentDebug;
    if (debug) {
      store.setVoiceIntentDebug({ ...debug, intent });
    }
  }
}

export function setVoiceCompletedPhase(statusLine: string): void {
  const store = useAppStore.getState();
  store.setVoicePhase("completed");
  store.setVoiceStatusLine(statusLine);
}

export function setVoiceReadyPhase(listenPhrase?: string): void {
  const store = useAppStore.getState();
  const phrase = listenPhrase ?? store.voiceListenPhrase;
  store.setVoicePhase("ready");
  store.setVoiceTranscript("");
  store.setVoiceInterimTranscript("");
  store.setVoiceTranscriptFrozen(false);
  store.setVoiceIntentDebug(null);
  store.setVoiceConfidence(null);
  store.setVoiceStatusLine(formatVoicePhaseLabel("ready", phrase));
}

export function setVoiceIntentDebugInfo(debug: VoiceIntentDebug | null): void {
  if (import.meta.env.VITE_DEBUG_VOICE !== "true") return;
  useAppStore.getState().setVoiceIntentDebug(debug);
}
