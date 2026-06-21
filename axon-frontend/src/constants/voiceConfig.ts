/**
 * Voice assistant configuration — single source of truth.
 *
 * Product branding remains "Axon Smart Mirror". Only the voice assistant
 * identity and wake word are defined here. To change the wake word in the
 * future, update this file and `axon-backend/app/core/voice_config.py`.
 */

/** Spoken assistant persona (not the product name). */
export const VOICE_ASSISTANT_NAME = "Nexa";

/** Wake word that activates the voice pipeline. */
export const WAKE_WORD = VOICE_ASSISTANT_NAME;

/** Idle mic label. */
export const SAY_WAKE_WORD_LABEL = `Say ${WAKE_WORD}`;

/** Shown when the always-on listener is armed. */
export const LISTENING_FOR_WAKE_LABEL = `Listening for ${WAKE_WORD}`;

/** Case-insensitive whole-word match for wake detection in STT transcripts. */
export function buildWakeWordPattern(): RegExp {
  return new RegExp(`\\b${escapeRegExp(WAKE_WORD)}\\b`, "i");
}

/** Strips wake word prefix from a command transcript. */
export function buildWakePrefixPattern(): RegExp {
  return new RegExp(`^${escapeRegExp(WAKE_WORD)}[,\\s!:.-]*`, "i");
}

export function stripWakeWordPrefix(transcript: string): string {
  return transcript.replace(buildWakePrefixPattern(), "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
