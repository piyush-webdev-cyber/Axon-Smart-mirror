/**
 * Speech-to-text for the active listening session (post wake-word).
 */

import {
  getSpeechRecognition,
  type SpeechRecognitionEvent,
  type SpeechRecognitionInstance,
} from "./speechRecognition";

export interface SttCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
  onStart?: () => void;
}

export class SttSession {
  private recognition: SpeechRecognitionInstance | null = null;
  private running = false;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxListenMs = 8000;

  isSupported(): boolean {
    return getSpeechRecognition() !== null;
  }

  start(callbacks: SttCallbacks): void {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      callbacks.onError("Speech recognition is not supported.");
      return;
    }

    this.stop();
    this.running = true;
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

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (result?.isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }

      if (interim.trim()) {
        callbacks.onInterim(interim.trim());
        this.resetSilenceTimer(callbacks);
      }
      if (finalText.trim()) {
        callbacks.onFinal(finalText.trim());
        this.resetSilenceTimer(callbacks);
      }
    };

    this.recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        callbacks.onError("Microphone permission denied.");
        return;
      }
      if (event.error !== "aborted" && event.error !== "no-speech") {
        callbacks.onError(event.error || "Speech recognition failed.");
      }
    };

    this.recognition.onend = () => {
      this.clearSilenceTimer();
      if (this.running) {
        this.running = false;
        callbacks.onEnd();
      }
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
    }, 1800);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  stop(): void {
    this.running = false;
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
