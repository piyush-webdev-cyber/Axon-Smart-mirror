/** Legacy bridge — delegates to the offline intent dispatcher. */

import type { NavigateFunction } from "react-router-dom";
import { executeIntent, voiceActionToIntent } from "@/features/voice/intentDispatcher";
import type { IntentPayload } from "@/features/voice/intentEngine";
import type { VoiceAction, VoiceProcessResult } from "@/types/voiceAssistant";

export function executeVoiceAction(
  action: VoiceAction,
  navigate: NavigateFunction,
  musicQuery?: string | null,
): void {
  if (!action) return;
  const payload: IntentPayload = {};
  if (musicQuery) payload.musicQuery = musicQuery;
  executeIntent(voiceActionToIntent(action), navigate, payload);
}

export function executeVoiceResult(result: VoiceProcessResult, navigate: NavigateFunction): void {
  executeVoiceAction(result.action, navigate, result.musicQuery ?? null);
}

export { executeIntent } from "@/features/voice/intentDispatcher";
