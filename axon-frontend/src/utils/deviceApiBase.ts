/**
 * Runtime API/WS base URLs for device linking.
 * Mirror and phone MUST share the same backend when QR points at Vercel LinkPage.
 */

import { env } from "./env";
import { getPublicMirrorOrigin } from "./publicMirrorUrl";

export const RAILWAY_API_BASE =
  "https://axon-smart-mirror-production.up.railway.app/api/v1";
export const RAILWAY_WS_URL =
  "wss://axon-smart-mirror-production.up.railway.app/api/v1/ws";

function isHostedLinkOrigin(origin: string): boolean {
  return /vercel\.app|railway\.app/i.test(origin);
}

/** True when the phone opens /link on Vercel (or QR targets hosted LinkPage). */
export function usesSharedRailwayBackend(): boolean {
  if (typeof window === "undefined") return false;

  if (window.location.hostname.includes("vercel.app")) {
    return true;
  }

  return isHostedLinkOrigin(getPublicMirrorOrigin());
}

/**
 * REST base for device linking.
 * - Phone on Vercel → same-origin /api/v1 (vercel.json proxy → Railway)
 * - Mirror with hosted QR → Railway directly
 * - Local LAN dev → env.apiBaseUrl (/api/v1 Vite proxy or :8010 Electron)
 */
export function deviceApiBase(): string {
  if (typeof window === "undefined") {
    return env.apiBaseUrl;
  }

  if (window.location.hostname.includes("vercel.app")) {
    return "/api/v1";
  }

  if (usesSharedRailwayBackend()) {
    return RAILWAY_API_BASE;
  }

  return env.apiBaseUrl;
}

/** WebSocket URL aligned with deviceApiBase for device.linked events. */
export function deviceWsUrl(): string {
  if (typeof window === "undefined") {
    return env.wsUrl;
  }

  if (usesSharedRailwayBackend()) {
    return RAILWAY_WS_URL;
  }

  return env.wsUrl;
}
