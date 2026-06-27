/**
 * Shared device-link transport rules.
 * Default: hosted Vercel LinkPage + Railway backend (Vercel web + Electron kiosk).
 * Set VITE_DEVICE_LINK_LOCAL=true only for pure LAN dev.
 */

export const HOSTED_MIRROR_ORIGIN = "https://axon-smart-mirror.vercel.app";

export const RAILWAY_API_BASE =
  "https://axon-smart-mirror-production.up.railway.app/api/v1";

export const RAILWAY_WS_URL =
  "wss://axon-smart-mirror-production.up.railway.app/api/v1/ws";

export function isElectronShell(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(
      (window as Window & { axonShell?: { isElectron?: boolean } }).axonShell
        ?.isElectron,
    )
  );
}

/** Opt-in LAN-only linking (mirror + phone on same Wi-Fi, local :8010). */
export function usesLocalDeviceLink(): boolean {
  return import.meta.env.VITE_DEVICE_LINK_LOCAL === "true";
}

/** Live hosted linking is the default for Vercel, Electron, and local dev. */
export function usesHostedDeviceLink(): boolean {
  return !usesLocalDeviceLink();
}

export function getHostedMirrorOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_MIRROR_URL?.replace(/\/$/, "");
  if (configured && /vercel\.app|railway\.app/i.test(configured)) {
    return configured;
  }
  return HOSTED_MIRROR_ORIGIN;
}
