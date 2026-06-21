/**
 * Always-on wake word service.
 *
 * Runs continuously in idle state with low CPU duty cycle (session restart
 * pattern). Does NOT send audio to Gemini — only triggers the voice pipeline
 * after local wake word detection.
 */

import { buildWakeWordPattern, WAKE_WORD } from "@/constants/voiceConfig";
import { isNativeVoiceEngine } from "@/features/voice/native/voiceEngineMode";
import { nativeWakeWordAdapter } from "@/features/voice/native/nativeWakeWordAdapter";
import {
  getSpeechRecognition,
  type SpeechRecognitionErrorEvent,
  type SpeechRecognitionEvent,
  type SpeechRecognitionInstance,
} from "./speechRecognition";

export { WAKE_WORD };

/** Minimum gap between wake triggers (prevents double-fire). */
const WAKE_COOLDOWN_MS = 2000;

const WAKE_PATTERN = buildWakeWordPattern();

export interface WakeWordHandlers {
  /** Fired when the wake word is detected in the audio stream. */
  onWakeDetected: () => void;
  /** Fired when the always-on listener is armed and running. */
  onArmed?: () => void;
  /** Fired when the listener stops (error, pause, or permission loss). */
  onDisarmed?: () => void;
  onError?: (message: string) => void;
}

export class WakeWordService {
  private static instance: WakeWordService | null = null;

  private recognition: SpeechRecognitionInstance | null = null;
  private handlers: WakeWordHandlers | null = null;
  private armed = false;
  private paused = false;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private lastWakeAt = 0;

  static getInstance(): WakeWordService {
    if (!WakeWordService.instance) {
      WakeWordService.instance = new WakeWordService();
    }
    return WakeWordService.instance;
  }

  isSupported(): boolean {
    if (isNativeVoiceEngine()) return nativeWakeWordAdapter.isSupported();
    return getSpeechRecognition() !== null;
  }

  isArmed(): boolean {
    return this.armed && !this.paused;
  }

  /** Start always-on wake word detection. */
  start(handlers: WakeWordHandlers): void {
    if (isNativeVoiceEngine()) {
      nativeWakeWordAdapter.start(handlers, () => this.startBrowserSession(handlers));
      return;
    }

    this.startBrowserSession(handlers);
  }

  private startBrowserSession(handlers: WakeWordHandlers): void {
    if (!getSpeechRecognition()) {
      handlers.onError?.("Speech recognition is not supported in this browser.");
      return;
    }

    this.handlers = handlers;
    this.paused = false;
    this.armed = true;
    this.startSession();
  }

  /** Pause while STT / TTS is active (mic is exclusive). */
  pause(): void {
    if (isNativeVoiceEngine()) {
      nativeWakeWordAdapter.pause();
      return;
    }

    this.paused = true;
    this.armed = false;
    this.clearRestart();
    this.destroyRecognition();
    this.handlers?.onDisarmed?.();
  }

  /** Resume always-on listening after a voice session completes. */
  resume(): void {
    if (isNativeVoiceEngine()) {
      nativeWakeWordAdapter.resume();
      return;
    }

    if (!this.handlers) return;
    this.paused = false;
    this.armed = true;
    this.startSession();
  }

  stop(): void {
    if (isNativeVoiceEngine()) {
      nativeWakeWordAdapter.stop();
      return;
    }

    this.paused = false;
    this.armed = false;
    this.clearRestart();
    this.destroyRecognition();
    this.handlers?.onDisarmed?.();
    this.handlers = null;
  }

  private destroyRecognition(): void {
    if (!this.recognition) return;
    try {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.onstart = null;
      this.recognition.abort();
    } catch {
      /* noop */
    }
    this.recognition = null;
  }

  private startSession(): void {
    if (this.paused || !this.handlers) return;

    const Ctor = getSpeechRecognition();
    if (!Ctor) return;

    this.destroyRecognition();
    this.recognition = new Ctor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.armed = true;
      this.handlers?.onArmed?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i]?.[0]?.transcript ?? "";
        if (!WAKE_PATTERN.test(transcript)) continue;

        const now = Date.now();
        if (now - this.lastWakeAt < WAKE_COOLDOWN_MS) return;
        this.lastWakeAt = now;

        this.pause();
        this.handlers?.onWakeDetected();
        return;
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "not-allowed") {
        this.armed = false;
        this.handlers?.onError?.("Microphone permission denied.");
        this.handlers?.onDisarmed?.();
        this.pause();
        return;
      }
      if (event.error === "no-speech" || event.error === "aborted") return;
      this.scheduleRestart(1200);
    };

    this.recognition.onend = () => {
      if (!this.paused && this.handlers) {
        this.scheduleRestart(350);
      }
    };

    try {
      this.recognition.start();
    } catch {
      this.scheduleRestart(900);
    }
  }

  private scheduleRestart(delayMs: number): void {
    if (this.paused || !this.handlers) return;
    this.clearRestart();
    this.restartTimer = setTimeout(() => this.startSession(), delayMs);
  }

  private clearRestart(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }
}

/** Singleton always-on wake word engine. */
export const wakeWordService = WakeWordService.getInstance();
