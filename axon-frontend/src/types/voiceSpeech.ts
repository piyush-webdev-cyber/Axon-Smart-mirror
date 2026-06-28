/**
 * Engine-agnostic speech recognition events consumed by the voice UI layer.
 * Browser SpeechRecognition, Faster-Whisper, Vosk, etc. map into these types.
 */

export type VoicePhase =
  | "ready"
  | "listening"
  | "recognizing"
  | "processing"
  | "executing"
  | "completed"
  | "error";

export interface SpeechResult {
  text: string;
  confidence?: number;
  language?: string;
  isFinal?: boolean;
}

export interface VoiceIntentDebug {
  intent: string;
  confidence: number;
  matchedPhrase: string;
}

export type VoiceSpeechEvent =
  | { type: "speechStarted"; language?: string }
  | { type: "speechPartial"; text: string; confidence?: number; language?: string }
  | { type: "speechFinal"; text: string; confidence?: number; language?: string }
  | { type: "speechError"; message: string; code?: string }
  | { type: "speechEnd" };

/** Hold final transcript visible before intent resolution (ms). */
export const FINAL_TRANSCRIPT_FREEZE_MS = 2500;
