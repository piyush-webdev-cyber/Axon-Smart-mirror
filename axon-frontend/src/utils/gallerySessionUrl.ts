/** Build a phone-reachable gallery session URL for QR codes. */

import { env } from "@/utils/env";

/**
 * Prefer VITE_PUBLIC_MIRROR_URL (your PC's LAN IP) so phones on the same
 * Wi-Fi can open the session. Falls back to the current browser origin.
 */
export function buildGallerySessionUrl(token: string): string {
  const base = (env.publicMirrorUrl || window.location.origin).replace(/\/$/, "");
  return `${base}/gallery/session/${token}`;
}

export function isLocalhostOrigin(): boolean {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}
