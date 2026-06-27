/** Phone-reachable mirror origin for QR codes and OAuth. */

import {
  getHostedMirrorOrigin,
  usesHostedDeviceLink,
} from "@/utils/deviceLinkConfig";
import { env } from "@/utils/env";

export function isLocalhostOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Origin embedded in QR codes — always the live Vercel LinkPage unless LAN dev mode.
 */
export function getPublicMirrorOrigin(): string {
  if (usesHostedDeviceLink()) {
    return getHostedMirrorOrigin();
  }

  if (import.meta.env.DEV && typeof window !== "undefined") {
    const lan = (window as Window & { __AXON_LAN_ORIGIN__?: string })
      .__AXON_LAN_ORIGIN__;
    if (lan) {
      return lan.replace(/\/$/, "");
    }
  }

  const configured = env.publicMirrorUrl?.replace(/\/$/, "");
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined" && !isLocalhostOrigin()) {
    return window.location.origin;
  }

  return typeof window !== "undefined" ? window.location.origin : "";
}

export function buildDeviceLinkUrl(code: string): string {
  const normalized = code.trim().toUpperCase();
  return `${getPublicMirrorOrigin()}/link/${encodeURIComponent(normalized)}`;
}

export function buildGallerySessionUrl(token: string): string {
  return `${getPublicMirrorOrigin()}/gallery/session/${encodeURIComponent(token)}`;
}
