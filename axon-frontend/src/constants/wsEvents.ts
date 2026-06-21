/**
 * Canonical WebSocket event-type registry shared by every feature.
 */
export const WS_EVENTS = {
  // Active in Phase 1
  systemConnected: "system.connected",
  ping: "system.ping",
  pong: "system.pong",
  deviceStatus: "device.status",

  // Phase 3 events
  deviceLinked: "device.linked",
  deviceExpired: "device.expired",
  photoCreated: "photo.created",
  photoDeleted: "photo.deleted",
  photoCaptureStarted: "photo.capture_started",
  photoCaptureCompleted: "photo.capture_completed",
  photoUploadStarted: "photo.upload_started",
  photoUploadCompleted: "photo.upload_completed",
  galleryOpened: "gallery.opened",
  galleryClosed: "gallery.closed",

  // Phase 4 — Voice assistant
  voiceWakeDetected: "voice.wake_detected",
  voiceWake: "voice.wake",
  voiceListening: "voice.listening",
  voiceTranscript: "voice.transcript",
  voiceProcessing: "voice.processing",
  voiceResponse: "voice.response",
  voiceSpeaking: "voice.speaking",
  voiceComplete: "voice.complete",
  voiceProcess: "voice.process",

  // Legacy alias
  voiceState: "voice.state",

  // Reserved for future phases
  interviewMessage: "interview.message",
  faceDetected: "face.detected",
  musicState: "music.state",
} as const;

export type WsEventType = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];
