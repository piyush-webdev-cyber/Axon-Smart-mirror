/**
 * WebSocket + microphone capture for native wake word / STT / TTS pipeline.
 * Streams PCM16 mono 16 kHz to FastAPI (OpenWakeWord + Faster-Whisper + Piper).
 */

import { env } from "@/utils/env";
import type { NativeVoiceEvent } from "@/types/axonVoice";

const TARGET_SAMPLE_RATE = 16_000;

type EventHandler = (event: NativeVoiceEvent) => void;

async function resolveVoiceBackendBase(): Promise<string | null> {
  const fromShell = window.axonVoice?.getVoiceBackendUrl?.();
  const resolved = fromShell instanceof Promise ? await fromShell : fromShell;

  if (typeof resolved === "string" && resolved.trim()) {
    return resolved.replace(/\/$/, "");
  }

  return null;
}

async function resolveVoiceWsUrl(): Promise<string | null> {
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
    return "ws://127.0.0.1:8010/api/v1/voice/desktop/ws";
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
  private running = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private ttsQueue: Promise<void> = Promise.resolve();

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
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

  async start(): Promise<boolean> {
    if (this.running) return true;

    const wsUrl = await resolveVoiceWsUrl();
    if (!wsUrl) {
      return false;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      this.emit({ type: "error", message: "Microphone access denied." });
      return false;
    }

    this.running = true;
    await this.connectWs(wsUrl);
    this.startAudioCapture();

    try {
      const base = await resolveVoiceBackendBase();
      if (base) {
        await fetch(`${base}/api/v1/voice/start`, { method: "POST" });
      }
    } catch {
      /* pipeline may already be running via WS connect */
    }

    return this.ws?.readyState === WebSocket.OPEN;
  }

  stop(): void {
    this.running = false;
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

  sendControl(action: string): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "control", action }));
  }

  pauseWake(): void {
    this.sendControl("pause_wake");
  }

  resumeWake(): void {
    this.sendControl("reset");
  }

  startSttCapture(): void {
    this.sendControl("start_stt");
  }

  stopSttCapture(): void {
    this.sendControl("stop_stt");
  }

  resetWake(): void {
    this.sendControl("reset");
  }

  async synthesize(text: string): Promise<ArrayBuffer | null> {
    try {
      const res = await fetch(await resolveTtsUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
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
    this.ttsQueue = this.ttsQueue.then(async () => {
      const wav = await this.synthesize(text);
      if (wav) await this._playWavBuffer(wav);
    });
    return this.ttsQueue;
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

  private async connectWs(url: string): Promise<void> {
    if (!this.running) return;

    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";

    await new Promise<void>((resolve) => {
      if (!this.ws) {
        resolve();
        return;
      }

      this.ws.onopen = () => resolve();

      this.ws.onmessage = (message) => {
        if (message.data instanceof ArrayBuffer) {
          void this.playWavBuffer(message.data);
          return;
        }
        if (typeof message.data !== "string") return;
        try {
          const event = JSON.parse(message.data) as NativeVoiceEvent;
          this.emit(event);
        } catch {
          /* ignore malformed */
        }
      };

      this.ws.onclose = () => {
        if (!this.running) return;
        this.reconnectTimer = setTimeout(() => {
          void resolveVoiceWsUrl().then((nextUrl) => {
            if (nextUrl) void this.connectWs(nextUrl);
          });
        }, 1200);
      };

      this.ws.onerror = () => {
        this.emit({ type: "error", message: "Voice pipeline connection failed." });
      };
    });
  }

  private startAudioCapture(): void {
    if (!this.mediaStream) return;

    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;

    this.audioContext = new Ctx({ sampleRate: TARGET_SAMPLE_RATE });
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = floatToPcm16(input, this.audioContext?.sampleRate ?? TARGET_SAMPLE_RATE);
      if (pcm.byteLength > 0) {
        this.ws.send(pcm);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  private teardownAudio(): void {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.processor = null;
    this.source = null;
    this.mediaStream?.getTracks().forEach((t) => t.stop());
    this.mediaStream = null;
    void this.audioContext?.close();
    this.audioContext = null;
  }
}

function floatToPcm16(input: Float32Array, sampleRate: number): ArrayBuffer {
  const ratio = sampleRate / TARGET_SAMPLE_RATE;
  const outLength = Math.floor(input.length / ratio);
  const buffer = new ArrayBuffer(outLength * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < outLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    const sample = Math.max(-1, Math.min(1, input[srcIndex] ?? 0));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

export const nativeVoiceClient = new NativeVoiceClient();
