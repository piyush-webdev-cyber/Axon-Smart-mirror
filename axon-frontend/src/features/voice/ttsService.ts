/**
 * Browser text-to-speech (Pi / Chromium compatible).
 * Electron uses Piper via nativeTtsAdapter when available.
 */

import { isNativeVoiceEngine } from "@/features/voice/native/voiceEngineMode";
import {
  isNativeSpeaking,
  isNativeTtsSupported,
  speakNative,
  stopNativeSpeaking,
} from "@/features/voice/native/nativeTtsAdapter";

let speaking = false;

export function isTtsSupported(): boolean {
  if (isNativeVoiceEngine() && isNativeTtsSupported()) return true;
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string): Promise<void> {
  if (isNativeVoiceEngine() && isNativeTtsSupported()) {
    return speakNative(text);
  }

  return new Promise((resolve, reject) => {
    if (!isTtsSupported()) {
      reject(new Error("Text-to-speech is not supported."));
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => v.lang.startsWith("en") && v.localService) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      speaking = true;
    };

    utterance.onend = () => {
      speaking = false;
      resolve();
    };

    utterance.onerror = () => {
      speaking = false;
      reject(new Error("Speech playback failed."));
    };

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (isNativeVoiceEngine()) {
    stopNativeSpeaking();
    return;
  }
  if (isTtsSupported()) {
    window.speechSynthesis.cancel();
  }
  speaking = false;
}

export function isSpeaking(): boolean {
  if (isNativeVoiceEngine()) return isNativeSpeaking();
  return speaking;
}
