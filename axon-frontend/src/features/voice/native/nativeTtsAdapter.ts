/**
 * Native TTS — Piper when configured, browser speechSynthesis fallback.
 */

import { nativeVoiceClient } from "./nativeVoiceClient";

export function isNativeTtsSupported(): boolean {
  return true;
}

export async function speakNative(text: string): Promise<void> {
  await nativeVoiceClient.playText(text);
}

export function stopNativeSpeaking(): void {
  nativeVoiceClient.stopPlayback();
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isNativeSpeaking(): boolean {
  return false;
}
