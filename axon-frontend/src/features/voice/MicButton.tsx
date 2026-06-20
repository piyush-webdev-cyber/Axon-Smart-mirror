import { Mic, Loader2, Volume2, AudioLines } from "lucide-react";
import { cn } from "@/utils/cn";
import type { VoiceState } from "@/types/voice";
import { useVoiceController } from "./useVoiceController";

const STATE_CONFIG: Record<
  VoiceState,
  { label: string; ring: string; icon: typeof Mic; iconClass?: string }
> = {
  idle: {
    label: "Tap to speak",
    ring: "bg-secondary/60 border-border/60",
    icon: Mic,
  },
  listening: {
    label: "Listening",
    ring: "bg-primary/20 border-primary/70 ring-glow",
    icon: AudioLines,
    iconClass: "text-primary",
  },
  processing: {
    label: "Thinking",
    ring: "bg-accent/20 border-accent/70",
    icon: Loader2,
    iconClass: "text-accent animate-spin",
  },
  speaking: {
    label: "Speaking",
    ring: "bg-primary/20 border-primary/70 ring-glow",
    icon: Volume2,
    iconClass: "text-primary",
  },
};

/**
 * Bottom-center region. The signature voice control for Axon.
 *
 * Phase 1 ships the full state machine and visuals (idle / listening /
 * processing / speaking). Phase 3 connects real audio to the same transitions.
 */
export function MicButton() {
  const { state, press } = useVoiceController();
  const config = STATE_CONFIG[state];
  const Icon = config.icon;
  const active = state === "listening" || state === "speaking";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={press}
        aria-label={config.label}
        aria-pressed={active}
        className={cn(
          "relative flex h-20 w-20 items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95",
          config.ring,
        )}
      >
        {active && (
          <span className="absolute inset-0 rounded-full bg-primary/30 animate-pulse-ring" />
        )}
        <Icon
          className={cn("size-8", config.iconClass)}
          strokeWidth={1.5}
        />
      </button>
      <span className="text-fluid-sm font-light tracking-wide text-muted-foreground">
        {config.label}
      </span>
    </div>
  );
}
