/**
 * Hardware abstraction — UI layer delegates to native or browser adapters.
 * Business logic should import from here, not call navigator/media APIs directly.
 */

export type PlatformProfile = "desktop" | "electron" | "raspberry_pi" | "android";

export interface MicrophoneAdapter {
  readonly available: boolean;
  readonly backend: string;
}

export interface SpeakerAdapter {
  readonly available: boolean;
  readonly backend: string;
}

export interface CameraAdapter {
  readonly available: boolean;
  readonly backend: string;
}

export function detectPlatformProfile(): PlatformProfile {
  if (typeof window !== "undefined" && window.axonShell?.isElectron) {
    return "electron";
  }
  return "desktop";
}

export function getMicrophoneAdapter(): MicrophoneAdapter {
  const electron = detectPlatformProfile() === "electron";
  return {
    available: Boolean(navigator.mediaDevices?.getUserMedia) || electron,
    backend: electron ? "backend-sounddevice" : "browser-getusermedia",
  };
}

export function getSpeakerAdapter(): SpeakerAdapter {
  return {
    available: "speechSynthesis" in window || detectPlatformProfile() === "electron",
    backend: detectPlatformProfile() === "electron" ? "piper-or-browser" : "browser-tts",
  };
}

export function getCameraAdapter(): CameraAdapter {
  return {
    available: Boolean(navigator.mediaDevices?.getUserMedia),
    backend: "browser-getusermedia",
  };
}
