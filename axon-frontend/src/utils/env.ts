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
  isDev: boolean;
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

  // In dev, connect directly to the backend WS endpoint. Vite's HTTP proxy
  // often fails WebSocket upgrades ("closed before handshake"), and localhost
  // vs 127.0.0.1 mismatches break the proxied path.
  if (import.meta.env.DEV) {
    return `ws://127.0.0.1:8010${path}`;
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
  isDev: import.meta.env.DEV,
};

/**
 * Helper function to get a specific environment variable.
 * Used by API clients for flexibility.
 */
export function getEnv(key: string): string {
  return read(key);
}
