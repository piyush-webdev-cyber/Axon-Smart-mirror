/**
 * Resolve REST + WebSocket bases at request time.
 *
 * Electron reads the actual backend URL from preload (may be :8011+ if :8010 stuck).
 * Browser Vite dev uses same-origin `/api/v1` (proxied to :8010).
 */

import { env } from "./env";
import {
  RAILWAY_API_BASE,
  RAILWAY_WS_URL,
  isElectronShell,
  usesHostedDeviceLink,
} from "./deviceLinkConfig";

const FALLBACK_ELECTRON_API = "http://127.0.0.1:18010/api/v1";
const FALLBACK_ELECTRON_WS = "ws://127.0.0.1:18010/api/v1/ws";

function electronApiBase(): string {
  if (typeof window !== "undefined") {
    const runtime = (window as Window & { axonRuntime?: { voiceApiBase?: string } }).axonRuntime;
    if (runtime?.voiceApiBase) return runtime.voiceApiBase;
  }
  return FALLBACK_ELECTRON_API;
}

function electronWsUrl(): string {
  if (typeof window !== "undefined") {
    const runtime = (window as Window & { axonRuntime?: { voiceWsUrl?: string } }).axonRuntime;
    if (runtime?.voiceWsUrl) return runtime.voiceWsUrl;
  }
  return FALLBACK_ELECTRON_WS;
}

function isVercelHost(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.includes("vercel.app")
  );
}

function isLocalDevSession(): boolean {
  return import.meta.env.DEV && typeof window !== "undefined" && !isVercelHost() && !isElectronShell();
}

function sameOriginWsUrl(): string {
  if (typeof window === "undefined") return env.wsUrl;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/v1/ws`;
}

/** REST base for music, photos, gallery, voice/process, etc. */
export function mirrorApiBase(): string {
  if (typeof window === "undefined") {
    return env.apiBaseUrl;
  }

  if (isElectronShell()) {
    return electronApiBase();
  }

  if (isVercelHost()) {
    return "/api/v1";
  }

  if (isLocalDevSession()) {
    return env.apiBaseUrl;
  }

  if (import.meta.env.PROD && !isElectronShell()) {
    return "/api/v1";
  }

  if (usesHostedDeviceLink()) {
    return RAILWAY_API_BASE;
  }

  return env.apiBaseUrl;
}

/** WebSocket URL aligned with mirrorApiBase() for music + voice events. */
export function mirrorWsUrl(): string {
  if (typeof window === "undefined") {
    return env.wsUrl;
  }

  if (isElectronShell()) {
    return electronWsUrl();
  }

  if (isVercelHost()) {
    return sameOriginWsUrl();
  }

  if (isLocalDevSession()) {
    return env.wsUrl;
  }

  if (import.meta.env.PROD && !isElectronShell()) {
    return sameOriginWsUrl();
  }

  if (usesHostedDeviceLink()) {
    return RAILWAY_WS_URL;
  }

  return env.wsUrl;
}
