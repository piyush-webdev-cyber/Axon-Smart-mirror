/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_API_BASE_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_PUBLIC_MIRROR_URL?: string;
  readonly VITE_WEATHER_CITY?: string;
  readonly VITE_WEATHER_LAT?: string;
  readonly VITE_WEATHER_LON?: string;
  readonly VITE_VOICE_ENGINE?: string;
  readonly VITE_USE_REMOTE_BACKEND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
