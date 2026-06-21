/** Auth headers for API calls (Supabase session or linked mirror token). */

import { supabase } from "@/services/supabaseClient";

export const MIRROR_TOKEN_KEY = "axon_mirror_token";
export const LINKED_USER_KEY = "axon_linked_user_id";

export function getMirrorToken(): string | null {
  return localStorage.getItem(MIRROR_TOKEN_KEY);
}

export function isMirrorLinked(): boolean {
  return Boolean(getMirrorToken() && localStorage.getItem(LINKED_USER_KEY));
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    return { Authorization: `Bearer ${data.session.access_token}` };
  }

  const mirrorToken = getMirrorToken();
  if (mirrorToken) {
    return { "X-Mirror-Token": mirrorToken };
  }

  throw new Error("Not authenticated");
}

export function storeMirrorAuth(userId: string, mirrorToken: string): void {
  localStorage.setItem(LINKED_USER_KEY, userId);
  localStorage.setItem(MIRROR_TOKEN_KEY, mirrorToken);
}
