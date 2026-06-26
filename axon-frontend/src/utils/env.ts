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

/** Baked-in production backend (Railway) — used when env vars are missing at build time. */
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

function toApiBaseUrl(raw: string): string {
  // Only the Electron desktop shell talks to FastAPI on loopback.
  if (isElectronShell() && import.meta.env.VITE_VOICE_ENGINE === "native") {
    return "http://127.0.0.1:8010/api/v1";
  }

  // Phone/browser on LAN dev server — never use loopback from .env.electron.
  if (import.meta.env.DEV && raw.startsWith("http") && isLoopbackUrl(raw)) {
    return "/api/v1";
  }

  if (raw.startsWith("http")) {
    return raw.replace(/\/$/, "");
  }

  // Production browser (Vercel) must hit Railway, not relative /api/v1 on Vercel.
  if (import.meta.env.PROD) {
    return PRODUCTION_API_BASE_URL;
  }

  return raw || "/api/v1";
}

function toWebSocketUrl(raw: string): string {
  if (isElectronShell() && import.meta.env.VITE_VOICE_ENGINE === "native") {
    return "ws://127.0.0.1:8010/api/v1/ws";
  }

  if (raw.startsWith("ws://") || raw.startsWith("wss://")) {
    return raw;
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;

  const remoteBackend = import.meta.env.VITE_USE_REMOTE_BACKEND === "true";

  // Browser dev (including phone scanning QR on LAN): direct WS to backend on mirror PC.
  if (import.meta.env.DEV && !remoteBackend) {
    return `ws://127.0.0.1:8010${path}`;
  }

  // Production: never fall back to Vercel host — always use Railway wss:// URL.
  if (import.meta.env.PROD) {
    if (raw.trim() && !raw.startsWith("ws")) {
      // eslint-disable-next-line no-console
      console.warn(
        "[axon] VITE_WS_URL should be a full wss:// URL in production; using Railway default.",
      );
    }
    return PRODUCTION_WS_URL;
  }

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

/** Log resolved endpoints once at startup (production debugging). */
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

/**
 * Helper function to get a specific environment variable.
 * Used by API clients for flexibility.
 */
export function getEnv(key: string): string {
  return read(key);
}
