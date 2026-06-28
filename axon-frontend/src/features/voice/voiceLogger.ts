/** Structured voice pipeline logging (browser + Electron). */

export type VoiceLogDomain = "wake" | "stt" | "intent" | "dispatch" | "error";

export function logVoice(
  domain: VoiceLogDomain,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const payload = { domain, event, ts: Date.now(), ...fields };
  console.info("[VOICE]", JSON.stringify(payload));
}

export function logVoiceIntent(
  transcript: string,
  intent: string,
  ms?: number,
): void {
  logVoice("intent", "detected", { transcript: transcript.slice(0, 120), intent, ms });
}

export function logVoiceDispatch(intent: string, ms?: number): void {
  logVoice("dispatch", "executed", { intent, ms });
}

export function logVoiceError(message: string, detail?: unknown): void {
  logVoice("error", "failure", { message, detail: String(detail ?? "") });
}
