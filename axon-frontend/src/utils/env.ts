/**
 * Centralized, typed access to Vite environment variables.
 * Fails loudly in development if a required variable is missing.
 */

interface AxonEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  wsUrl: string;
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

function toWebSocketUrl(value: string): string {
  if (value.startsWith("ws://") || value.startsWith("wss://")) {
    return value;
  }

  if (typeof window === "undefined") {
    return value;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${protocol}//${window.location.host}${path}`;
}

export const env: AxonEnv = {
  supabaseUrl: read("VITE_SUPABASE_URL"),
  supabaseAnonKey: read("VITE_SUPABASE_ANON_KEY"),
  apiBaseUrl: read("VITE_API_BASE_URL", "/api/v1"),
  wsUrl: toWebSocketUrl(read("VITE_WS_URL", "/api/v1/ws")),
  isDev: import.meta.env.DEV,
};
