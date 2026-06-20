/**
 * Finite-state model for the voice assistant mic button.
 * Phase 1 ships the state machine and visuals only; Phase 3 wires real audio
 * into the exact same transitions.
 */
export type VoiceState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

export type VoiceEvent =
  | "startListening"
  | "stopListening"
  | "responseReady"
  | "done"
  | "cancel"
  | "error";
