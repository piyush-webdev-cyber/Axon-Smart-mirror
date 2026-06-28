/**
 * Voice assistant configuration — single source of truth.
 *
 * Product branding remains "Axon Smart Mirror". Only the voice assistant
 * identity and wake word are defined here. To change the wake word in the
 * future, update this file and `axon-backend/app/core/voice_config.py`.
 */

/** Spoken assistant persona (not the product name). */
export const VOICE_ASSISTANT_NAME = "Jarvis";

/** Primary wake phrase shown in UI. */
export const WAKE_WORD = "hey jarvis";

/** Alternate wake words accepted by the browser listener. */
export const WAKE_WORD_ALIASES = ["hey jarvis", "jarvis", "axon"] as const;

/** Idle mic label. */
export const SAY_WAKE_WORD_LABEL = `Say "${WAKE_WORD}" or Axon`;

/** Shown when the always-on listener is armed. */
export const LISTENING_FOR_WAKE_LABEL = `Listening for ${WAKE_WORD}`;

/** Brief label after wake word fires. */
export const WAKE_DETECTED_LABEL = "Wake word detected";

/** Active command capture. */
export const LISTENING_COMMAND_LABEL = "Recording";

/** Case-insensitive whole-word match for wake detection in STT transcripts. */
export function buildWakeWordPattern(): RegExp {
  return /\b(hey[\s,]+jarvis|jarvis|axon|nexa)\b/i;
}

/** Strips wake word prefix from a command transcript. */
export function buildWakePrefixPattern(): RegExp {
  return /^(?:hey[\s,]+jarvis|jarvis|axon|nexa)[,\s!:.-]*/i;
}

export function stripWakeWordPrefix(transcript: string): string {
  return transcript.replace(buildWakePrefixPattern(), "").trim();
}
