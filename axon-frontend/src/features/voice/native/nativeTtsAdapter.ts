/**
 * Native TTS via Piper (FastAPI /voice/tts).
 */

import { nativeVoiceClient } from "./nativeVoiceClient";

let speaking = false;
let currentAudio: HTMLAudioElement | null = null;

export function isNativeTtsSupported(): boolean {
  return true;
}

export async function speakNative(text: string): Promise<void> {
  const wav = await nativeVoiceClient.synthesize(text);
  if (!wav) {
    throw new Error("Native TTS unavailable.");
  }

  stopNativeSpeaking();

  return new Promise((resolve, reject) => {
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudio = audio;
    speaking = true;

    audio.onended = () => {
      speaking = false;
      URL.revokeObjectURL(url);
      currentAudio = null;
      resolve();
    };

    audio.onerror = () => {
      speaking = false;
      URL.revokeObjectURL(url);
      currentAudio = null;
      reject(new Error("Native speech playback failed."));
    };

    void audio.play().catch(reject);
  });
}

export function stopNativeSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  speaking = false;
}

export function isNativeSpeaking(): boolean {
  return speaking;
}
