import { useVoicePipeline } from "./useVoicePipeline";

/** Activates the voice pipeline inside the router tree. Renders nothing. */
export function VoiceEffects() {
  useVoicePipeline();
  return null;
}
