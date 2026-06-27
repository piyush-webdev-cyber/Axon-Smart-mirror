/** Auth headers for API calls (Supabase session or linked mirror token). */

import { deviceApi } from "@/services/deviceApi";
import { supabase } from "@/services/supabaseClient";
import { ACTIVE_DEVICE_CODE_KEY } from "@/utils/mirrorLink";

export const MIRROR_TOKEN_KEY = "axon_mirror_token";
export const LINKED_USER_KEY = "axon_linked_user_id";
export const DISPLAY_NAME_KEY = "axon_display_name";
export const EMAIL_KEY = "axon_linked_email";
export const LINKED_DEVICE_CODE_KEY = "axon_linked_device_code";
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

export function getLinkedDeviceCode(): string | null {
  return localStorage.getItem(LINKED_DEVICE_CODE_KEY);
}

export function storeLinkedDeviceCode(code: string): void {
  localStorage.setItem(LINKED_DEVICE_CODE_KEY, code.trim().toUpperCase());
}

export function getMirrorToken(): string | null {
  return localStorage.getItem(MIRROR_TOKEN_KEY);
}

export function isMirrorLinked(): boolean {
  return Boolean(getMirrorToken() && getLinkedUserId());
}

/** Resolve linked device code from storage or the active link session. */
export function resolveLinkedDeviceCode(): string | null {
  const saved = getLinkedDeviceCode();
  if (saved) return saved.trim().toUpperCase();

  const active = sessionStorage.getItem(ACTIVE_DEVICE_CODE_KEY);
  if (active) {
    const normalized = active.trim().toUpperCase();
    storeLinkedDeviceCode(normalized);
    return normalized;
  }

  return null;
}

export async function refreshMirrorSession(): Promise<void> {
  const userId = getLinkedUserId();
  const code = resolveLinkedDeviceCode();
  if (!userId || !code) return;

  try {
    const status = await deviceApi.checkDeviceStatus(code);
    if (status.status === "linked" && status.user_id && status.mirror_token) {
      storeMirrorAuth(status.user_id, status.mirror_token);
      storeLinkedDeviceCode(code);
    }
  } catch {
    /* server will fall back to code+user headers */
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const mirrorToken = getMirrorToken();
  const userId = getLinkedUserId();
  const linkedCode = resolveLinkedDeviceCode();

  if (mirrorToken) {
    headers["X-Mirror-Token"] = mirrorToken;
  }
  if (userId) {
    headers["X-Linked-User-Id"] = userId;
  }
  if (linkedCode) {
    headers["X-Linked-Code"] = linkedCode;
  }

  if (mirrorToken || userId) {
    return headers;
  }

  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) {
    return { Authorization: `Bearer ${data.session.access_token}` };
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
  localStorage.removeItem(LINKED_DEVICE_CODE_KEY);
  window.dispatchEvent(new Event(MIRROR_LINKED_EVENT));
}
