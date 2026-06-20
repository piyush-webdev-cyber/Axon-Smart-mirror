/**
 * Canonical WebSocket event-type registry shared by every feature.
 * Phase 1 only uses connection/system events; the rest are reserved so future
 * real-time features (voice, interview, face, music) plug in without changing
 * the transport layer.
 */
export const WS_EVENTS = {
  // Active in Phase 1
  systemConnected: "system.connected",
  ping: "system.ping",
  pong: "system.pong",
  deviceStatus: "device.status",

  // Reserved for future phases (handlers registered but inert in Phase 1)
  voiceState: "voice.state",
  voiceTranscript: "voice.transcript",
  interviewMessage: "interview.message",
  faceDetected: "face.detected",
  musicState: "music.state",
} as const;

export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
