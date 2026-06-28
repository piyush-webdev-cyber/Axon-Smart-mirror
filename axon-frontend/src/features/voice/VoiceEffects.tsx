import { useVoicePipeline } from "./useVoicePipeline";
import { useMusicVoiceBridge } from "@/features/music/useMusicVoiceBridge";

/** Activates the voice pipeline inside the router tree. Renders nothing. */
export function VoiceEffects() {
  useVoicePipeline();
  useMusicVoiceBridge();
  return null;
}
