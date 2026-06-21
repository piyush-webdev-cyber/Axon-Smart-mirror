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
  return Boolean(window.axonVoice?.isNativeEngine?.());
}

export function isVoiceEngineAvailable(): boolean {
  const browserSpeech = Boolean(
    typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition),
  );
  if (browserSpeech) return true;
  return isNativeVoiceEngine();
}
