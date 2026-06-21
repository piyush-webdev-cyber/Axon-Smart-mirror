/** Phone-reachable mirror origin for QR codes and OAuth (not localhost on the mirror PC). */

import { env } from "@/utils/env";

export function isLocalhostOrigin(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/**
 * Origin embedded in QR codes from the mirror display.
 * Prefers VITE_PUBLIC_MIRROR_URL so phones are not sent to localhost.
 */
export function getPublicMirrorOrigin(): string {
  const configured = env.publicMirrorUrl?.replace(/\/$/, "");
  if (configured) return configured;

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
