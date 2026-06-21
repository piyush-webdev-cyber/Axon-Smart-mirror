/** Native voice engine events from the desktop WebSocket pipeline. */
export type NativeVoiceEvent =
  | { type: "status"; state?: string; wakeword?: { available: boolean } }
  | { type: "wake_armed"; wakeWord: string }
  | { type: "wake_detected"; wakeWord: string }
  | { type: "stt_interim"; text: string }
  | { type: "stt_final"; text: string }
  | { type: "stt_end" }
  | { type: "error"; message: string };

export interface AxonShellAPI {
  isElectron: boolean;
  isKiosk: boolean;
  setKiosk: (enabled: boolean) => Promise<void>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  getAutoLaunch: () => Promise<boolean>;
  getVoiceBackendUrl: () => Promise<string>;
}

export interface AxonVoiceAPI {
  isNativeEngine: () => boolean;
  getVoiceBackendUrl: () => Promise<string>;
}

declare global {
  interface Window {
    axonShell?: AxonShellAPI;
    axonVoice?: AxonVoiceAPI;
  }
}

export {};
