import { Mic } from "lucide-react";
import { cn } from "@/utils/cn";
import {
  LISTENING_COMMAND_LABEL,
  SAY_WAKE_WORD_LABEL,
  WAKE_DETECTED_LABEL,
} from "@/constants/voiceConfig";
import type { VoiceState } from "@/types/voice";
import { useVoiceController } from "./useVoiceController";

const STATE_LABEL: Record<VoiceState, string> = {
  idle: SAY_WAKE_WORD_LABEL,
  listening: LISTENING_COMMAND_LABEL,
  processing: "Processing...",
  speaking: "Speaking...",
};

function getLabel(
  state: VoiceState,
  micReady: boolean,
  wakeActive: boolean,
  wakePulse: boolean,
  listenPhrase: string,
): string {
  if (!micReady && state === "idle") {
    return "Allow microphone access";
  }
  if (wakePulse && state === "idle") {
    return WAKE_DETECTED_LABEL;
  }
  if (wakeActive && state === "idle") {
    return `Listening for ${listenPhrase}`;
  }
  if (state === "idle") {
    return `Say ${listenPhrase}`;
  }
  return STATE_LABEL[state];
}

/** Five-bar pseudo-waveform for the speaking state (transform-only). */
const WAVE_BARS = [
  { delay: "0ms", height: "40%" },
  { delay: "120ms", height: "74%" },
  { delay: "60ms", height: "100%" },
  { delay: "180ms", height: "66%" },
  { delay: "240ms", height: "46%" },
];

/**
 * Bottom-center region. Axon's living core - the visual focal point and most
 * important surface in the product. Even at rest it breathes and its aura
 * slowly orbits, so the mirror reads as an awake intelligence rather than a
 * static control. Phase 2 ships all four visual states; Phase 3 wires real
 * audio into the same FSM (see useVoiceController). Motion is transform/opacity
 * only for 60 FPS on the Pi.
 */
export function MicButton() {
  const { state, micReady, wakeActive, wakePulse, listenPhrase, press } = useVoiceController();
  const label = getLabel(state, micReady, wakeActive, wakePulse, listenPhrase);

  const isIdle = state === "idle";
  const isListening = state === "listening";
  const isProcessing = state === "processing";
  const isSpeaking = state === "speaking";
  const isActive = isListening || isSpeaking;
  const isArmed = micReady && wakeActive && isIdle;
  const isWakeFlash = wakePulse && isIdle;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={press}
        aria-label={label}
        aria-pressed={isActive}
        className={cn(
          "group relative grid place-items-center rounded-full",
          "h-[clamp(3.05rem,5vw,4rem)] w-[clamp(3.05rem,5vw,4rem)]",
          "transition-transform duration-300 ease-out active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background",
        )}
      >
        {/* Subtle living aura, intentionally restrained to match the reference. */}
        <span
          aria-hidden
          className={cn(
            "ai-aura absolute -inset-[36%] rounded-full blur-xl gpu animate-[orbit_20s_linear_infinite] transition-opacity duration-700",
            isActive ? "opacity-75" : isWakeFlash ? "opacity-90 animate-glow-pulse" : isProcessing ? "opacity-62" : isArmed ? "opacity-55" : "opacity-35",
          )}
        />

        {/* Tiny side glints like the screenshot's peripheral spark points. */}
        <span aria-hidden className="absolute -left-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-accent/80 blur-[1px]" />
        <span aria-hidden className="absolute -right-2.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary/80 blur-[1px]" />

        {/* Soft radial bloom anchoring the core */}
        <span
          aria-hidden
          className={cn(
            "absolute -inset-[12%] -z-10 rounded-full bg-glow-radial blur-md transition-opacity duration-500",
            isActive ? "opacity-90 animate-glow-pulse" : isArmed ? "opacity-60 animate-glow-pulse" : "opacity-45",
          )}
        />

        {/* Core disc */}
        <span
          aria-hidden
          className={cn(
            "glass-surface absolute inset-0 rounded-full transition-shadow duration-500",
            isIdle && (isWakeFlash ? "ring-glow animate-pulse-ring" : isArmed ? "animate-pulse-ring" : "animate-breathe"),
            isListening && "ring-glow",
            isSpeaking && "ring-glow",
          )}
        />

        {/* Hairline presence ring */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full border border-content/10"
        />

        {/* LISTENING: concentric pulsing rings */}
        {(isListening || isArmed) && (
          <>
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full border animate-pulse-ring gpu",
                isListening ? "border-primary/70" : "border-primary/30",
              )}
            />
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-full border animate-pulse-ring gpu [animation-delay:0.9s]",
                isListening ? "border-primary/40" : "border-primary/20",
              )}
            />
            {isListening && (
              <span
                aria-hidden
                className="absolute inset-[-8%] rounded-full border border-primary/25 animate-pulse-ring gpu [animation-delay:0.45s]"
              />
            )}
          </>
        )}

        {/* PROCESSING: dual orbit with leading comet dots */}
        {isProcessing && (
          <>
            <span
              aria-hidden
              className="absolute inset-[-4%] rounded-full animate-orbit gpu"
            >
              <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-accent ring-glow" />
            </span>
            <span
              aria-hidden
              className="absolute inset-[12%] rounded-full animate-orbit-reverse gpu"
            >
              <span className="absolute bottom-0 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary/80" />
            </span>
          </>
        )}

        {/* Foreground content per state */}
        {isSpeaking ? (
          <span
            aria-hidden
            className="relative flex h-[34%] items-center justify-center gap-[0.14rem]"
          >
            {WAVE_BARS.map((bar, i) => (
              <span
                key={i}
                className="w-[0.1rem] rounded-full bg-primary animate-wave gpu"
                style={{ height: bar.height, animationDelay: bar.delay }}
              />
            ))}
          </span>
        ) : isListening ? (
          <span
            aria-hidden
            className="relative flex h-[34%] items-center justify-center gap-[0.12rem]"
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="w-[0.1rem] rounded-full bg-primary animate-wave gpu"
                style={{
                  height: `${40 + (i % 3) * 22}%`,
                  animationDelay: `${i * 90}ms`,
                }}
              />
            ))}
          </span>
        ) : (
          <Mic
            className={cn(
              "relative size-[40%] transition-colors duration-300",
              isArmed ? "text-primary/80" : "text-content",
              isProcessing && "opacity-40",
            )}
            strokeWidth={1.5}
            aria-hidden
          />
        )}
      </button>

      <span
        key={`${state}-${micReady}`}
        className={cn(
          "text-caption animate-fade-in transition-colors",
          isActive || isArmed ? "text-content" : "text-content-muted",
        )}
      >
        {label}
      </span>
    </div>
  );
}
