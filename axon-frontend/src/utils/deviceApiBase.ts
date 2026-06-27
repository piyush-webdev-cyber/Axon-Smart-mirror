/**
 * Runtime API/WS base URLs for device linking.
 * Mirror and phone MUST share the same backend when QR points at Vercel LinkPage.
 */

import { env } from "./env";
import {
  RAILWAY_API_BASE,
  RAILWAY_WS_URL,
  usesHostedDeviceLink,
} from "./deviceLinkConfig";

export { RAILWAY_API_BASE, RAILWAY_WS_URL } from "./deviceLinkConfig";

/** True when mirror and phone must share Railway (hosted QR / LinkPage). */
export function usesSharedRailwayBackend(): boolean {
  return usesHostedDeviceLink();
}

/**
 * REST base for device linking.
 * - Phone on Vercel → same-origin /api/v1 (vercel.json proxy → Railway)
 * - Electron / hosted QR → Railway directly
 * - Local LAN dev (VITE_DEVICE_LINK_LOCAL) → env.apiBaseUrl
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
