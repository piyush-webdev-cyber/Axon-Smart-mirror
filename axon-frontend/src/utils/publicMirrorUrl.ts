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
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const lan = (window as Window & { __AXON_LAN_ORIGIN__?: string }).__AXON_LAN_ORIGIN__;
    if (lan) return lan.replace(/\/$/, "");
  }

  const configured = env.publicMirrorUrl?.replace(/\/$/, "");
  if (configured) {
    const prodHosted = /vercel\.app|railway\.app/i.test(configured);
    if (!(import.meta.env.DEV && prodHosted)) {
      return configured;
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[axon] Ignoring production VITE_PUBLIC_MIRROR_URL in local dev — using LAN origin",
    );
  }

  // Production Electron kiosk — phones open the hosted link page.
  if (typeof window !== "undefined" && window.axonShell?.isElectron && import.meta.env.PROD) {
    return "https://axon-smart-mirror.vercel.app";
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
