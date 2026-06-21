/** Auth headers for API calls (Supabase session or linked mirror token). */

import { supabase } from "@/services/supabaseClient";

export const MIRROR_TOKEN_KEY = "axon_mirror_token";
export const LINKED_USER_KEY = "axon_linked_user_id";
export const DISPLAY_NAME_KEY = "axon_display_name";
export const EMAIL_KEY = "axon_linked_email";
export const MIRROR_LINKED_EVENT = "axon:mirror-linked";

export function getLinkedUserId(): string | null {
  return localStorage.getItem(LINKED_USER_KEY);
}

export function getLinkedDisplayName(): string | null {
  return localStorage.getItem(DISPLAY_NAME_KEY);
}

export function getLinkedEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function getMirrorToken(): string | null {
  return localStorage.getItem(MIRROR_TOKEN_KEY);
}

export function isMirrorLinked(): boolean {
  return Boolean(getMirrorToken() && getLinkedUserId());
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
  window.dispatchEvent(new Event(MIRROR_LINKED_EVENT));
}

export function storeLinkedDisplayName(name: string): void {
  localStorage.setItem(DISPLAY_NAME_KEY, name);
  window.dispatchEvent(new Event(MIRROR_LINKED_EVENT));
}

export function storeLinkedEmail(email: string): void {
  localStorage.setItem(EMAIL_KEY, email);
  window.dispatchEvent(new Event(MIRROR_LINKED_EVENT));
}

export function clearMirrorAuth(): void {
  localStorage.removeItem(LINKED_USER_KEY);
  localStorage.removeItem(MIRROR_TOKEN_KEY);
  localStorage.removeItem(DISPLAY_NAME_KEY);
  localStorage.removeItem(EMAIL_KEY);
  window.dispatchEvent(new Event(MIRROR_LINKED_EVENT));
}
