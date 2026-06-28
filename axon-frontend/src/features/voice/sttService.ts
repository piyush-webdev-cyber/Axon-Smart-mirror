/**
 * Speech-to-text for the active listening session (post wake-word).
 */

import {
  getSpeechRecognition,
  type SpeechRecognitionEvent,
  type SpeechRecognitionInstance,
} from "./speechRecognition";
import { isNativeVoiceEngine, isElectronRuntime } from "@/features/voice/native/voiceEngineMode";
import { nativeSttAdapter } from "@/features/voice/native/nativeSttAdapter";

export interface SttPartialResult {
  text: string;
  confidence?: number;
  language?: string;
}

export interface SttCallbacks {
  onInterim: (result: SttPartialResult) => void;
  onFinal: (result: SttPartialResult) => void;
  onError: (message: string) => void;
  onEnd: () => void;
  onStart?: () => void;
}

export interface SttStartOptions {
  /** Backend already capturing after wake-word detection. */
  fromWakeWord?: boolean;
  /** Use browser Web Speech even in Electron native mode (manual mic tap). */
  forceBrowser?: boolean;
}

export class SttSession {
  private recognition: SpeechRecognitionInstance | null = null;
  private running = false;
  private browserMode = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxListenMs = 10000;
  private readonly silenceMs = 2200;
  private restartAttempts = 0;
  private readonly maxRestartAttempts = 8;

  isSupported(): boolean {
    if (isNativeVoiceEngine()) return nativeSttAdapter.isSupported();
    return getSpeechRecognition() !== null;
  }

  start(callbacks: SttCallbacks, options?: SttStartOptions): void {
    if (isNativeVoiceEngine() && !options?.forceBrowser) {
      this.browserMode = false;
      nativeSttAdapter.start(callbacks, options);
      return;
    }

    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      callbacks.onError("Speech recognition is not supported.");
      return;
    }

    this.stopBrowserOnly();
    this.browserMode = true;
    this.running = true;
    this.restartAttempts = 0;
    this.recognition = new Ctor();
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      callbacks.onStart?.();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let finalText = "";
      let confidence: number | undefined;
      const language = this.recognition?.lang ?? "en-US";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result?.[0];
        const transcript = alt?.transcript ?? "";
        if (result?.isFinal) {
          finalText += transcript;
          if (alt?.confidence != null && alt.confidence > 0) {
            confidence = alt.confidence;
          }
        } else {
          interim += transcript;
          if (alt?.confidence != null && alt.confidence > 0) {
            confidence = alt.confidence;
          }
        }
      }

      if (interim.trim()) {
        callbacks.onInterim({
          text: interim.trim(),
          ...(confidence != null ? { confidence } : {}),
          language,
        });
        this.resetSilenceTimer(callbacks);
      }
      if (finalText.trim()) {
        callbacks.onFinal({
          text: finalText.trim(),
          ...(confidence != null ? { confidence } : {}),
          language,
        });
        this.resetSilenceTimer(callbacks);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        this.running = false;
        callbacks.onError("Microphone permission denied.");
        return;
      }
      if (event.error === "no-speech" && isElectronRuntime() && this.running) {
        return;
      }
      if (event.error !== "aborted" && event.error !== "no-speech") {
        this.running = false;
        callbacks.onError(event.error || "Speech recognition failed.");
      }
    };

    this.recognition.onend = () => {
      this.clearSilenceTimer();
      if (!this.running) return;

      if (isElectronRuntime() && this.restartAttempts < this.maxRestartAttempts) {
        this.restartAttempts += 1;
        window.setTimeout(() => {
          if (!this.running || !this.recognition) return;
          try {
            this.recognition.start();
          } catch {
            this.running = false;
            callbacks.onEnd();
          }
        }, 120);
        return;
      }

      this.running = false;
      this.browserMode = false;
      callbacks.onEnd();
    };

    try {
      this.recognition.start();
      this.silenceTimer = setTimeout(() => this.stop(), this.maxListenMs);
    } catch {
      callbacks.onError("Could not start microphone.");
    }
  }

  private resetSilenceTimer(callbacks: SttCallbacks): void {
    this.clearSilenceTimer();
    this.silenceTimer = setTimeout(() => {
      if (this.running) {
        this.stop();
        callbacks.onEnd();
      }
    }, this.silenceMs);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  stop(): void {
    if (this.browserMode) {
      this.stopBrowserOnly();
      return;
    }

    if (isNativeVoiceEngine()) {
      nativeSttAdapter.stop();
    }
  }

  private stopBrowserOnly(): void {
    this.running = false;
    this.browserMode = false;
    this.restartAttempts = 0;
    this.clearSilenceTimer();
    try {
      this.recognition?.stop();
    } catch {
      try {
        this.recognition?.abort();
      } catch {
        /* noop */
      }
    }
    this.recognition = null;
  }
}

export const sttSession = new SttSession();
