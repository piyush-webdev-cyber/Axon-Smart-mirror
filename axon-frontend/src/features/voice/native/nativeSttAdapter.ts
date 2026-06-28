/**
 * Native STT adapter — command capture handled by FastAPI Faster-Whisper.
 */

import type { SttCallbacks, SttStartOptions } from "@/features/voice/sttService";
import { nativeVoiceClient } from "./nativeVoiceClient";
import type { NativeVoiceEvent } from "@/types/axonVoice";

let running = false;
let callbacks: SttCallbacks | null = null;
let unsubscribe: (() => void) | null = null;

function onEvent(event: NativeVoiceEvent): void {
  if (!running || !callbacks) return;

  if (event.type === "stt_interim") {
    callbacks.onInterim({ text: event.text, language: "en" });
    return;
  }

  if (event.type === "stt_final") {
    callbacks.onFinal({ text: event.text, language: "en" });
    return;
  }

  if (event.type === "stt_end") {
    running = false;
    callbacks.onEnd();
    return;
  }

  if (event.type === "error") {
    running = false;
    callbacks.onError(event.message);
  }
}

export const nativeSttAdapter = {
  isSupported: () => true,

  start(cbs: SttCallbacks, options?: SttStartOptions): void {
    callbacks = cbs;
    running = true;

    unsubscribe?.();
    unsubscribe = nativeVoiceClient.subscribe(onEvent);

    cbs.onStart?.();

    if (!options?.fromWakeWord) {
      nativeVoiceClient.startSttCapture();
    }
  },

  stop(): void {
    if (!running) {
      nativeVoiceClient.stopSttCapture();
      return;
    }
    running = false;
    nativeVoiceClient.stopSttCapture();
    unsubscribe?.();
    unsubscribe = null;
    callbacks = null;
  },
};
