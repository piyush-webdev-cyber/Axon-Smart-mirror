import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/utils/env";

/**
 * Single Supabase browser client. Used for authentication (Google + email) and
 * realtime auth-state changes. RLS on the backend protects all data, so the
 * public anon key is safe to ship to the browser.
 */
// Fall back to harmless placeholders so the app still boots before Supabase is
// configured. Auth calls simply fail gracefully until real keys are provided.
const SUPABASE_URL = env.supabaseUrl || "http://localhost:54321";
const SUPABASE_ANON_KEY = env.supabaseAnonKey || "public-anon-placeholder";

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

/** Convenience helper to fetch the current access token for backend calls. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
