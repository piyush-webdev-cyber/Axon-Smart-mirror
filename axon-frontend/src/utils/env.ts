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

function toWebSocketUrl(raw: string): string {
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) {
    return raw;
  }

  const path = raw.startsWith("/") ? raw : `/${raw}`;

  // Electron and explicit remote-backend mode always use configured URLs.
  const remoteBackend =
    import.meta.env.MODE === "electron" ||
    import.meta.env.VITE_USE_REMOTE_BACKEND === "true";

  // In browser dev, connect directly to local backend WS unless remote is configured.
  if (import.meta.env.DEV && !remoteBackend) {
    return `ws://127.0.0.1:8010${path}`;
  }

  // Production: prefer explicit wss:// from VITE_WS_URL (Railway backend).
  // Relative paths would incorrectly target the Vercel host.
  if (import.meta.env.PROD && raw.trim()) {
    // eslint-disable-next-line no-console
    console.warn(
      "[axon] VITE_WS_URL should be a full wss:// URL in production (Railway backend).",
    );
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
  apiBaseUrl: read("VITE_API_BASE_URL", "/api/v1"),
  wsUrl: toWebSocketUrl(read("VITE_WS_URL", "/api/v1/ws")),
  publicMirrorUrl: read("VITE_PUBLIC_MIRROR_URL"),
  weatherCity: read("VITE_WEATHER_CITY"),
  weatherLat: readOptionalFloat("VITE_WEATHER_LAT"),
  weatherLon: readOptionalFloat("VITE_WEATHER_LON"),
  isDev: import.meta.env.DEV,
};

/**
 * Helper function to get a specific environment variable.
 * Used by API clients for flexibility.
 */
export function getEnv(key: string): string {
  return read(key);
}
