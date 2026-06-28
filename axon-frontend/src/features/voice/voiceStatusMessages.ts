import { MirrorIntent } from "@/features/voice/intentEngine";
import type { VoicePhase } from "@/types/voiceSpeech";

export function formatVoicePhaseLabel(
  phase: VoicePhase,
  listenPhrase: string,
): string {
  switch (phase) {
    case "ready":
      return `🟢 Ready · say “${listenPhrase}” or tap the mic`;
    case "listening":
      return "🎤 Listening…";
    case "recognizing":
      return "📝 Recognizing…";
    case "processing":
      return "Processing command…";
    case "executing":
      return "Executing…";
    case "completed":
      return "Done";
    case "error":
      return "Voice error";
    default:
      return "";
  }
}

const EXECUTION_MESSAGES: Partial<Record<MirrorIntent, string>> = {
  [MirrorIntent.TAKE_PHOTO]: "⚡ Taking photo…",
  [MirrorIntent.OPEN_CAMERA]: "⚡ Opening camera…",
  [MirrorIntent.CLOSE_CAMERA]: "⚡ Closing camera…",
  [MirrorIntent.OPEN_GALLERY]: "⚡ Opening gallery…",
  [MirrorIntent.SHOW_MY_PHOTOS]: "⚡ Preparing your photos…",
  [MirrorIntent.GIVE_ME_MY_PHOTOS]: "⚡ Preparing QR code…",
  [MirrorIntent.DELETE_LAST_PHOTO]: "⚡ Deleting last photo…",
  [MirrorIntent.PLAY_MUSIC]: "⚡ Playing music…",
  [MirrorIntent.PLAY_SPECIFIC_SONG]: "⚡ Playing song…",
  [MirrorIntent.PAUSE_MUSIC]: "⚡ Pausing music…",
  [MirrorIntent.RESUME_MUSIC]: "⚡ Resuming music…",
  [MirrorIntent.STOP_MUSIC]: "⚡ Stopping music…",
  [MirrorIntent.NEXT_SONG]: "⚡ Next track…",
  [MirrorIntent.PREVIOUS_SONG]: "⚡ Previous track…",
  [MirrorIntent.OPEN_SETTINGS]: "⚡ Opening settings…",
  [MirrorIntent.OPEN_HOME]: "⚡ Going home…",
  [MirrorIntent.HOME]: "⚡ Going home…",
  [MirrorIntent.SHOW_WEATHER]: "⚡ Loading weather…",
  [MirrorIntent.REFRESH_WEATHER]: "⚡ Updating weather…",
  [MirrorIntent.LOGOUT]: "⚡ Signing out…",
};

const COMPLETED_MESSAGES: Partial<Record<MirrorIntent, string>> = {
  [MirrorIntent.TAKE_PHOTO]: "✅ Photo captured successfully",
  [MirrorIntent.DELETE_LAST_PHOTO]: "✅ Photo deleted",
  [MirrorIntent.PLAY_MUSIC]: "✅ Music playing",
  [MirrorIntent.PLAY_SPECIFIC_SONG]: "✅ Song playing",
  [MirrorIntent.PAUSE_MUSIC]: "✅ Music paused",
  [MirrorIntent.OPEN_GALLERY]: "✅ Gallery opened",
  [MirrorIntent.GIVE_ME_MY_PHOTOS]: "✅ QR code ready",
  [MirrorIntent.UNKNOWN]: "❌ Couldn't understand",
};

export function getExecutionStatus(intent: MirrorIntent): string {
  return EXECUTION_MESSAGES[intent] ?? "⚡ Running command…";
}

export function getCompletedStatus(intent: MirrorIntent): string {
  return COMPLETED_MESSAGES[intent] ?? "✅ Done";
}
