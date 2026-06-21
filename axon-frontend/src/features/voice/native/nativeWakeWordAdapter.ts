/**
 * Native wake-word adapter — delegates to FastAPI OpenWakeWord pipeline.
 */

import type { WakeWordHandlers } from "@/features/voice/wakeWordService";
import { nativeVoiceClient } from "./nativeVoiceClient";
import type { NativeVoiceEvent } from "@/types/axonVoice";

let armed = false;
let paused = false;
let handlers: WakeWordHandlers | null = null;
let unsubscribe: (() => void) | null = null;

function onEvent(event: NativeVoiceEvent): void {
  if (!handlers || paused) return;

  if (event.type === "wake_armed") {
    armed = true;
    handlers.onArmed?.();
    return;
  }

  if (event.type === "wake_detected") {
    armed = false;
    paused = true;
    handlers.onWakeDetected();
    return;
  }

  if (event.type === "error") {
    handlers.onError?.(event.message);
    armed = false;
    handlers.onDisarmed?.();
  }
}

export const nativeWakeWordAdapter = {
  isSupported: () => true,

  isArmed: () => armed && !paused,

  start(h: WakeWordHandlers, onFallback?: () => void): void {
    handlers = h;
    paused = false;
    armed = true;

    unsubscribe?.();
    unsubscribe = nativeVoiceClient.subscribe(onEvent);

    void nativeVoiceClient.start().then((ok) => {
      if (!ok) {
        armed = false;
        handlers = null;
        unsubscribe?.();
        unsubscribe = null;
        onFallback?.();
      }
    });
  },

  pause(): void {
    paused = true;
    armed = false;
    nativeVoiceClient.pauseWake();
    handlers?.onDisarmed?.();
  },

  resume(): void {
    if (!handlers) return;
    paused = false;
    armed = true;
    nativeVoiceClient.resetWake();
    handlers.onArmed?.();
  },

  stop(): void {
    paused = false;
    armed = false;
    unsubscribe?.();
    unsubscribe = null;
    nativeVoiceClient.stop();
    handlers?.onDisarmed?.();
    handlers = null;
  },
};
