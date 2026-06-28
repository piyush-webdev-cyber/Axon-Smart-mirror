/**
 * Runtime API/WS base URLs for device linking.
 * Device QR + phone linking use Railway when hosted; music/photos use mirrorApiBase().
 */

import { env } from "./env";
import {
  RAILWAY_API_BASE,
  RAILWAY_WS_URL,
  isElectronShell,
  usesHostedDeviceLink,
} from "./deviceLinkConfig";
import { mirrorWsUrl } from "./apiRouting";

export { RAILWAY_API_BASE, RAILWAY_WS_URL } from "./deviceLinkConfig";

/** True when mirror and phone must share Railway (hosted QR / LinkPage). */
export function usesSharedRailwayBackend(): boolean {
  return usesHostedDeviceLink();
}

function isVercelHost(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.includes("vercel.app")
  );
}

/** REST base for device linking only (QR codes, link status). */
export function deviceApiBase(): string {
  if (typeof window === "undefined") {
    return env.apiBaseUrl;
  }

  if (isVercelHost()) {
    return "/api/v1";
  }

  // Electron + hosted QR: phones link via Railway/Vercel — keep device API on Railway.
  if (isElectronShell() && usesHostedDeviceLink()) {
    return RAILWAY_API_BASE;
  }

  if (usesHostedDeviceLink()) {
    return RAILWAY_API_BASE;
  }

  return env.apiBaseUrl;
}

/** WebSocket for device.linked events — Railway when hosted, else mirror WS. */
export function deviceWsUrl(): string {
  if (typeof window === "undefined") {
    return env.wsUrl;
  }

  if (isVercelHost()) {
    return mirrorWsUrl();
  }

  if (isElectronShell() && usesHostedDeviceLink()) {
    return RAILWAY_WS_URL;
  }

  if (usesHostedDeviceLink()) {
    return RAILWAY_WS_URL;
  }

  return mirrorWsUrl();
}
