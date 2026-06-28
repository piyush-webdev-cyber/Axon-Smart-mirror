/**
 * Detect whether the native (Electron + FastAPI ML) voice stack should be used.
 * Browser deployments on Vercel keep the Web Speech API path.
 */

export function isElectronRuntime(): boolean {
  return Boolean(typeof window !== "undefined" && window.axonShell?.isElectron);
}

export function isNativeVoiceEngine(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.VITE_VOICE_ENGINE !== "native") return false;
  // Browser Vite dev has no Faster-Whisper — use Web Speech API instead.
  if (!isElectronRuntime()) return false;
  return Boolean(window.axonVoice?.isNativeEngine?.());
}

export function isVoiceEngineAvailable(): boolean {
  if (isNativeVoiceEngine()) return true;
  const browserSpeech = Boolean(
    typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  return browserSpeech;
}
