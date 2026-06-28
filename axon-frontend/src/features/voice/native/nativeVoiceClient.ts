/**
 * WebSocket + microphone capture for native wake word / STT / TTS pipeline.
 * Streams PCM16 mono 16 kHz to FastAPI (OpenWakeWord + Faster-Whisper + Piper).
 */

import { env } from "@/utils/env";
import type { NativeVoiceEvent } from "@/types/axonVoice";

const TARGET_SAMPLE_RATE = 16_000;

type EventHandler = (event: NativeVoiceEvent) => void;

async function resolveVoiceBackendBase(): Promise<string | null> {
  if (typeof window !== "undefined") {
    const runtime = (window as Window & { axonRuntime?: { voiceBackendUrl?: string } }).axonRuntime;
    if (runtime?.voiceBackendUrl) {
      return runtime.voiceBackendUrl.replace(/\/$/, "");
    }
  }

  const fromShell = window.axonVoice?.getVoiceBackendUrl?.();
  const resolved = fromShell instanceof Promise ? await fromShell : fromShell;

  if (typeof resolved === "string" && resolved.trim()) {
    return resolved.replace(/\/$/, "");
  }

  return null;
}

async function resolveVoiceWsUrl(): Promise<string | null> {
  if (typeof window !== "undefined") {
    const runtime = (window as Window & { axonRuntime?: { voiceWsUrl?: string } }).axonRuntime;
    if (runtime?.voiceWsUrl) {
      return `${runtime.voiceWsUrl.replace(/\/ws\/?$/, "")}/voice/desktop/ws`;
    }
  }

  const base = await resolveVoiceBackendBase();
  if (base) {
    if (!base.includes("127.0.0.1") && !base.includes("localhost")) {
      return null;
    }
    return `${base.replace(/^http/, "ws")}/api/v1/voice/desktop/ws`;
  }

  if (env.wsUrl.includes("ws://") || env.wsUrl.includes("wss://")) {
    const root = env.wsUrl.replace(/\/ws\/?$/, "");
    if (root.includes("127.0.0.1") || root.includes("localhost")) {
      return `${root}/voice/desktop/ws`;
    }
    return null;
  }

  if (import.meta.env.DEV) {
    return "ws://127.0.0.1:18010/api/v1/voice/desktop/ws";
  }

  return null;
}

async function resolveTtsUrl(): Promise<string> {
  const base = await resolveVoiceBackendBase();
  if (base && (base.includes("127.0.0.1") || base.includes("localhost"))) {
    return `${base}/api/v1/voice/tts`;
  }
  return `${env.apiBaseUrl.replace(/\/$/, "")}/voice/tts`;
}

class NativeVoiceClient {
  private ws: WebSocket | null = null;
  private handlers = new Set<EventHandler>();
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muteGain: GainNode | null = null;
  private running = false;
  private connecting = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private ttsQueue: Promise<void> = Promise.resolve();
  private lastPcmSentAt = 0;
  private unlockBound = false;
  private piperKnownUnavailable = false;
  private ttsProbeDone = false;

  /** Skip Piper HTTP when the local backend reports browser-only TTS. */
  private async probeTtsAvailability(): Promise<void> {
    if (this.ttsProbeDone) return;
    this.ttsProbeDone = true;

    try {
      const { mirrorApiBase } = await import("@/utils/apiRouting");
      const statusUrl = `${mirrorApiBase()}/voice/status`;
      const res = await fetch(statusUrl);
      if (!res.ok) {
        this.piperKnownUnavailable = true;
        return;
      }
      const status = (await res.json()) as { nativeTts?: boolean; native_tts?: boolean; tts?: string };
      const nativeTts = status.nativeTts ?? status.native_tts ?? status.tts === "piper";
      if (!nativeTts) this.piperKnownUnavailable = true;
    } catch {
      this.piperKnownUnavailable = true;
    }
  }
  private localMicActive = false;

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isLocalMicActive(): boolean {
    return this.localMicActive;
  }

  isAudioStreaming(): boolean {
    if (this.localMicActive && this.isConnected()) return true;
    if (this.audioContext?.state !== "running") return false;
    return Date.now() - this.lastPcmSentAt < 2500;
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit(event: NativeVoiceEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }

  /** Must run after a user gesture so wake-word PCM reaches the backend. */
  async unlockAudio(): Promise<boolean> {
    if (!this.mediaStream) return false;

    if (!this.audioContext || this.audioContext.state === "closed") {
      this.startAudioCapture();
    }

    await this.resumeAudio();

    if (this.audioContext?.state === "running") {
      this.emit({ type: "audio_streaming" });
      return true;
    }

    this.emit({ type: "audio_blocked" });
    return false;
  }

  bindUnlockGestures(): void {
    if (this.unlockBound || typeof document === "undefined") return;
    this.unlockBound = true;

    const tryUnlock = () => {
      void this.unlockAudio();
    };

    document.addEventListener("pointerdown", tryUnlock, { passive: true });
    document.addEventListener("keydown", tryUnlock, { passive: true });

    if (typeof window !== "undefined") {
      window.__axonUnlockVoiceAudio = () => this.unlockAudio();
    }
  }

  async start(): Promise<boolean> {
    if (this.running && this.isConnected()) return true;
    if (this.connecting) {
      await this.waitForBackendStatus(8000);
      return this.isConnected();
    }

    this.connecting = true;
    const wasRunning = this.running;
    this.running = true;
    try {
      const wsUrl = await resolveVoiceWsUrl();
      if (!wsUrl) {
        this.running = wasRunning;
        return false;
      }

      const connected = await this.connectWs(wsUrl);
      if (!connected) {
        this.running = wasRunning;
        this.emit({ type: "error", message: "Voice backend unavailable." });
        return false;
      }

      await this.probeTtsAvailability();

      await this.waitForBackendStatus(2500);

      if (this.localMicActive) {
        this.emit({ type: "audio_streaming" });
      } else if (!this.mediaStream) {
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: true,
            },
          });
        } catch {
          this.running = wasRunning;
          this.emit({ type: "error", message: "Microphone access denied." });
          return false;
        }
        this.bindUnlockGestures();
        if (!this.processor) {
          this.startAudioCapture();
        }
        await this.unlockAudio();
      }

      try {
        const base = await resolveVoiceBackendBase();
        if (base) {
          await fetch(`${base}/api/v1/voice/start`, { method: "POST" });
        }
      } catch {
        /* pipeline may already be running via WS connect */
      }

      return this.ws?.readyState === WebSocket.OPEN;
    } finally {
      this.connecting = false;
    }
  }

  private waitForBackendStatus(timeoutMs: number): Promise<void> {
    if (this.localMicActive) return Promise.resolve();
    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const tick = () => {
        if (this.localMicActive || Date.now() >= deadline) {
          resolve();
          return;
        }
        window.setTimeout(tick, 40);
      };
      tick();
    });
  }

  stop(): void {
    this.running = false;
    this.localMicActive = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPlayback();
    this.teardownAudio();
    try {
      this.ws?.close();
    } catch {
      /* noop */
    }
    this.ws = null;
  }

  sendControl(action: string, payload: Record<string, unknown> = {}): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type: "control", action, ...payload }));
    return true;
  }

  pauseWake(): void {
    this.sendControl("pause_wake");
  }

  resumeWake(): void {
    this.sendControl("reset");
  }

  async startSttCapture(context: Record<string, unknown> = {}): Promise<boolean> {
    void this.unlockAudio();

    const base = await resolveVoiceBackendBase();
    if (base) {
      try {
        const res = await fetch(`${base}/api/v1/voice/capture/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context),
        });
        if (res.ok) return true;
      } catch {
        /* fall through to WS control */
      }
    }

    if (this.sendControl("start_stt", context)) return true;

    this.emit({ type: "error", message: "Voice backend not connected." });
    return false;
  }

  async stopSttCapture(): Promise<boolean> {
    const base = await resolveVoiceBackendBase();
    if (base) {
      try {
        const res = await fetch(`${base}/api/v1/voice/capture/stop`, { method: "POST" });
        if (res.ok) return true;
      } catch {
        /* fall through */
      }
    }
    return this.sendControl("stop_stt");
  }

  resetWake(): void {
    this.sendControl("reset");
  }

  async synthesize(text: string): Promise<ArrayBuffer | null> {
    if (this.piperKnownUnavailable) return null;

    try {
      const res = await fetch(await resolveTtsUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.status === 503 || res.status === 204) {
        this.piperKnownUnavailable = true;
        return null;
      }
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch {
      return null;
    }
  }

  playWavBuffer(buffer: ArrayBuffer): Promise<void> {
    this.ttsQueue = this.ttsQueue.then(() => this._playWavBuffer(buffer));
    return this.ttsQueue;
  }

  playText(text: string): Promise<void> {
    this.ttsQueue = this.ttsQueue
      .then(() => this._playText(text))
      .catch(() => {
        /* TTS is best-effort; captions still show the reply */
      });
    return this.ttsQueue;
  }

  waitForPlayback(): Promise<void> {
    return this.ttsQueue;
  }

  private async _playText(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!this.piperKnownUnavailable) {
      const wav = await this.synthesize(trimmed);
      if (wav && wav.byteLength > 0) {
        await this._playWavBuffer(wav);
        return;
      }
      this.piperKnownUnavailable = true;
    }

    await speakWithBrowser(trimmed);
  }

  stopPlayback(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = "";
      this.currentAudio = null;
    }
  }

  private _playWavBuffer(buffer: ArrayBuffer): Promise<void> {
    this.stopPlayback();
    return new Promise((resolve, reject) => {
      const blob = new Blob([buffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        reject(new Error("Native speech playback failed."));
      };
      void audio.play().catch(reject);
    });
  }

  private async connectWs(url: string, attempts = 20): Promise<boolean> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!this.running && !this.connecting) return false;

      const connected = await this.tryConnectOnce(url);
      if (connected) return true;

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
  }

  private tryConnectOnce(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.running && !this.connecting) {
        resolve(false);
        return;
      }

      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      let settled = false;

      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        if (!ok) {
          try {
            ws.close();
          } catch {
            /* noop */
          }
        }
        resolve(ok);
      };

      const timeout = window.setTimeout(() => finish(false), 5000);

      ws.onopen = () => {
        window.clearTimeout(timeout);
        this.ws = ws;
        this.attachWsHandlers(ws);
        finish(true);
      };

      ws.onerror = () => {
        window.clearTimeout(timeout);
        finish(false);
      };

      ws.onclose = () => {
        if (!settled) {
          window.clearTimeout(timeout);
          finish(false);
        }
      };
    });
  }

  private attachWsHandlers(ws: WebSocket): void {
    ws.onmessage = (message) => {
      if (message.data instanceof ArrayBuffer) {
        void this.playWavBuffer(message.data);
        return;
      }
      if (typeof message.data !== "string") return;
      try {
        const event = JSON.parse(message.data) as NativeVoiceEvent;
        if (event.type === "status" && "localMicActive" in event && event.localMicActive) {
          this.localMicActive = true;
        }
        if (event.type === "audio_streaming") {
          this.localMicActive = true;
        }
        this.emit(event);
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      if (!this.running) return;
      this.reconnectTimer = setTimeout(() => {
        void this.start();
      }, 1200);
    };

    ws.onerror = () => {
      this.emit({ type: "error", message: "Voice pipeline connection failed." });
    };
  }

  private startAudioCapture(): void {
    if (!this.mediaStream) return;

    this.teardownAudioGraph();

    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    this.audioContext = new Ctx({ sampleRate: TARGET_SAMPLE_RATE });
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.muteGain = this.audioContext.createGain();
    this.muteGain.gain.value = 0;

    this.processor.onaudioprocess = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      if (this.audioContext?.state !== "running") {
        this.emit({ type: "audio_blocked" });
        return;
      }

      const input = event.inputBuffer.getChannelData(0);
      const pcm = floatToPcm16(input, this.audioContext.sampleRate);
      if (pcm.byteLength > 0) {
        this.ws.send(pcm);
        this.lastPcmSentAt = Date.now();
        this.emit({ type: "audio_streaming" });
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.audioContext.destination);
  }

  async resumeAudio(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  private teardownAudioGraph(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.muteGain?.disconnect();
    this.processor = null;
    this.source = null;
    this.muteGain = null;
    void this.audioContext?.close();
    this.audioContext = null;
  }

  private teardownAudio(): void {
    this.teardownAudioGraph();
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    this.lastPcmSentAt = 0;
  }
}

function floatToPcm16(input: Float32Array, sampleRate: number): ArrayBuffer {
  const ratio = sampleRate / TARGET_SAMPLE_RATE;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const buffer = new ArrayBuffer(outLength * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < outLength; i += 1) {
    const srcIndex = Math.min(input.length - 1, Math.floor(i * ratio));
    const sample = Math.max(-1, Math.min(1, input[srcIndex] ?? 0));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

function speakWithBrowser(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve();
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) {
      resolve();
      return;
    }

    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      resolve();
    };

    const speakNow = () => {
      try {
        window.speechSynthesis.cancel();
        window.setTimeout(() => {
          if (finished) return;

          const utterance = new SpeechSynthesisUtterance(trimmed);
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.volume = 1;

          const voices = window.speechSynthesis.getVoices();
          const preferred =
            voices.find((v) => v.lang.startsWith("en") && v.localService) ??
            voices.find((v) => v.lang.startsWith("en"));
          if (preferred) utterance.voice = preferred;

          utterance.onend = done;
          utterance.onerror = done;

          window.speechSynthesis.speak(utterance);

          // Some Chromium builds never fire onend/onerror — don't hang forever.
          window.setTimeout(done, Math.max(4000, trimmed.length * 80));
        }, 64);
      } catch {
        done();
      }
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      speakNow();
      return;
    }

    let spoke = false;
    const onVoices = () => {
      if (spoke) return;
      spoke = true;
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      speakNow();
    };

    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    window.setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      if (!spoke) speakNow();
    }, 400);
  });
}

declare global {
  interface Window {
    __axonUnlockVoiceAudio?: () => Promise<boolean>;
  }
}

export const nativeVoiceClient = new NativeVoiceClient();
