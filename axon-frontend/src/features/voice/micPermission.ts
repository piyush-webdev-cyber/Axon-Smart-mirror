/** Microphone access for always-on wake word (no button press required). */

import { isNativeVoiceEngine } from "@/features/voice/native/voiceEngineMode";

let micGranted = false;
let pending: Promise<boolean> | null = null;

export function isMicGranted(): boolean {
  return micGranted;
}

export function isSpeechRecognitionAvailable(): boolean {
  if (isNativeVoiceEngine()) return true;
  return Boolean(
    typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition),
  );
}

export function isVoiceEngineAvailable(): boolean {
  return isSpeechRecognitionAvailable();
}

async function queryMicPermission(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return null;
  }
}

/**
 * Request microphone access. Called automatically on mirror boot — the browser
 * shows its permission prompt (not the Axon mic button).
 */
export async function requestMicAccess(): Promise<boolean> {
  if (micGranted) return true;
  if (pending) return pending;

  pending = (async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return false;
    }

    const perm = await queryMicPermission();
    if (perm === "denied") {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      micGranted = true;
      return true;
    } catch {
      return false;
    } finally {
      pending = null;
    }
  })();

  return pending;
}

/** Resume AudioContext after browser autoplay policy (called on wake). */
export async function primeAudioContext(): Promise<void> {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  await ctx.close();
}
