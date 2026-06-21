/**
 * Subtle UI feedback tones via Web Audio (no external assets, Pi-friendly).
 */

import type { VoiceState } from "@/types/voice";

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

async function resumeContext(): Promise<AudioContext | null> {
  const ctx = getContext();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
  return ctx;
}

function tone(
  frequency: number,
  durationMs: number,
  options: { type?: OscillatorType; gain?: number; delay?: number } = {},
): void {
  void (async () => {
    const ctx = await resumeContext();
    if (!ctx) return;

    const { type = "sine", gain = 0.08, delay = 0 } = options;
    const start = ctx.currentTime + delay / 1000;
    const end = start + durationMs / 1000;

    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(amp);
    amp.connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.05);
  })();
}

export async function playMicUnlockSound(): Promise<void> {
  await resumeContext();
  tone(440, 90, { gain: 0.06 });
  tone(660, 120, { gain: 0.07, delay: 90 });
}

export function playWakeActivationSound(): void {
  void resumeContext();
  // Premium activation chirp — under 300ms, Siri/ChatGPT-like ascending tone
  tone(587, 45, { type: "sine", gain: 0.055 });
  tone(880, 45, { type: "sine", gain: 0.06, delay: 40 });
  tone(1175, 70, { type: "sine", gain: 0.045, delay: 78 });
}

/** @deprecated Use playWakeActivationSound */
export function playWakeDetectedSound(): void {
  playWakeActivationSound();
}

export function playVoiceStateSound(
  state: VoiceState,
  prev: VoiceState,
  options?: { skipListening?: boolean },
): void {
  if (state === prev) return;

  switch (state) {
    case "listening":
      if (!options?.skipListening) {
        tone(523, 80, { gain: 0.05 });
      }
      break;
    case "processing":
      tone(392, 80, { type: "triangle", gain: 0.05 });
      break;
    case "speaking":
      tone(659, 70, { gain: 0.06 });
      break;
    case "idle":
      if (prev === "speaking" || prev === "processing") {
        tone(440, 100, { gain: 0.04, delay: 0 });
      }
      break;
    default:
      break;
  }
}

export function playErrorSound(): void {
  tone(220, 180, { type: "triangle", gain: 0.06 });
}
