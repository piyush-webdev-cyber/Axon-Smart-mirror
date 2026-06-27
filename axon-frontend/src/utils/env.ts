/**
 * Centralized, typed access to Vite environment variables.
 * Fails loudly in development if a required variable is missing.
 */

interface AxonEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  wsUrl: string;
  /** LAN-reachable mirror URL for phone QR (e.g. http://192.168.1.5:5173) */
  publicMirrorUrl: string;
  /** Fallback weather city when geolocation is unavailable (e.g. Delhi,IN) */
  weatherCity: string;
  weatherLat: number | null;
  weatherLon: number | null;
  isDev: boolean;
}

/** Shared backend for device linking when phone uses hosted LinkPage (Vercel → Railway). */
const PRODUCTION_API_BASE_URL =
  "https://axon-smart-mirror-production.up.railway.app/api/v1";
const PRODUCTION_WS_URL =
  "wss://axon-smart-mirror-production.up.railway.app/api/v1/ws";

function readOptionalFloat(key: string): number | null {
  const raw = read(key);
  if (!raw.trim()) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function read(key: string, fallback = ""): string {
  const value = import.meta.env[key as keyof ImportMetaEnv] as
    | string
    | undefined;
  if (!value && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[axon] Missing env var: ${key}`);
  }
  return value ?? fallback;
}

function isElectronShell(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean((window as Window & { axonShell?: { isElectron?: boolean } }).axonShell?.isElectron)
  );
}

function isLoopbackUrl(raw: string): boolean {
  return raw.includes("127.0.0.1") || raw.includes("localhost");
}

/**
 * True when the QR / LinkPage is hosted (Vercel) while the mirror may run locally (Electron).
 * Device codes must be created on the same backend the phone hits (Railway).
 */
function usesHostedDeviceLink(): boolean {
  if (import.meta.env.PROD && !isElectronShell()) {
    return true;
  }
  const mirror = read("VITE_PUBLIC_MIRROR_URL");
  return /vercel\.app|railway\.app/i.test(mirror);
}

/** Browser dev: route WS through the Vite dev-server proxy (same host as the page). */
function devProxyWebSocketUrl(): string {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/api/v1/ws`;
  }
  return "ws://localhost:5173/api/v1/ws";
}

function toApiBaseUrl(raw: string): string {
  // Electron: voice stays on loopback; device linking uses Railway when QR is hosted.
  if (isElectronShell() && import.meta.env.VITE_VOICE_ENGINE === "native") {
    if (usesHostedDeviceLink()) {
      return PRODUCTION_API_BASE_URL;
    }
    return "http://127.0.0.1:8010/api/v1";
  }

  if (import.meta.env.DEV && raw.startsWith("http") && isLoopbackUrl(raw)) {
    return "/api/v1";
  }

  if (import.meta.env.PROD && !isElectronShell()) {
    return "/api/v1";
  }

  if (raw.startsWith("http")) {
    return raw.replace(/\/$/, "");
  }

  if (raw.startsWith("/")) {
    return raw.replace(/\/$/, "") || "/api/v1";
  }

  return "/api/v1";
}

function toWebSocketUrl(raw: string): string {
  if (isElectronShell() && import.meta.env.VITE_VOICE_ENGINE === "native") {
    if (usesHostedDeviceLink()) {
      return PRODUCTION_WS_URL;
    }
    return "ws://127.0.0.1:8010/api/v1/ws";
  }

  const remoteBackend = import.meta.env.VITE_USE_REMOTE_BACKEND === "true";

  if (import.meta.env.DEV && !remoteBackend) {
    if (raw.startsWith("ws://") || raw.startsWith("wss://")) {
      if (isLoopbackUrl(raw)) {
        return devProxyWebSocketUrl();
      }
      return raw;
    }
    return devProxyWebSocketUrl();
  }

  if (raw.startsWith("wss://")) {
    return raw;
  }

  if (import.meta.env.PROD) {
    return PRODUCTION_WS_URL;
  }

  if (raw.startsWith("ws://")) {
    return raw;
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;

  if (typeof window === "undefined") {
    return path;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export const env: AxonEnv = {
  supabaseUrl: read("VITE_SUPABASE_URL"),
  supabaseAnonKey: read("VITE_SUPABASE_ANON_KEY"),
  apiBaseUrl: toApiBaseUrl(read("VITE_API_BASE_URL", "/api/v1")),
  wsUrl: toWebSocketUrl(read("VITE_WS_URL", "/api/v1/ws")),
  publicMirrorUrl: read("VITE_PUBLIC_MIRROR_URL"),
  weatherCity: read("VITE_WEATHER_CITY"),
  weatherLat: readOptionalFloat("VITE_WEATHER_LAT"),
  weatherLon: readOptionalFloat("VITE_WEATHER_LON"),
  isDev: import.meta.env.DEV,
};

export function logAxonEnv(): void {
  // eslint-disable-next-line no-console
  console.info("[axon] Runtime config", {
    mode: import.meta.env.MODE,
    apiBaseUrl: env.apiBaseUrl,
    wsUrl: env.wsUrl,
    publicMirrorUrl: env.publicMirrorUrl || "(unset)",
    isElectron: isElectronShell(),
  });
}

export function getEnv(key: string): string {
  return read(key);
}
