/** Persist mirror QR-link session on the mirror display. */

import { useAppStore } from "@/store";
import type { DeviceStatus } from "@/types/device";
import {
  storeLinkedDisplayName,
  storeLinkedEmail,
  storeMirrorAuth,
  storeLinkedDeviceCode,
  getLinkedDisplayName,
  getLinkedEmail,
  getLinkedUserId,
  isMirrorLinked,
} from "@/utils/authToken";

export const ACTIVE_DEVICE_CODE_KEY = "axon_active_device_code";

export interface MirrorLinkPayload {
  userId: string;
  mirrorToken: string;
  displayName?: string | null;
  email?: string | null;
  linkedDeviceCode?: string | null;
}

/** Apply a successful device link immediately (sync — no event race). */
export function applyMirrorLink(payload: MirrorLinkPayload): void {
  const { userId, mirrorToken, displayName, email, linkedDeviceCode } = payload;

  storeMirrorAuth(userId, mirrorToken);

  if (displayName) {
    storeLinkedDisplayName(displayName);
  }
  if (email) {
    storeLinkedEmail(email);
  }
  if (linkedDeviceCode) {
    storeLinkedDeviceCode(linkedDeviceCode);
  }

  sessionStorage.removeItem(ACTIVE_DEVICE_CODE_KEY);

  useAppStore.getState().applyMirrorLink({
    userId,
    email: email ?? null,
    displayName: displayName ?? null,
  });
}

export function deviceStatusToLinkPayload(status: DeviceStatus): MirrorLinkPayload | null {
  if (status.status !== "linked" || !status.user_id || !status.mirror_token) {
    return null;
  }

  return {
    userId: status.user_id,
    mirrorToken: status.mirror_token,
    ...(status.display_name ? { displayName: status.display_name } : {}),
    ...(status.email ? { email: status.email } : {}),
  };
}

export function readMirrorLinkFromStorage(): {
  mirrorLinked: boolean;
  mirrorUserId: string | null;
  mirrorEmail: string | null;
  mirrorDisplayName: string | null;
} {
  return {
    mirrorLinked: isMirrorLinked(),
    mirrorUserId: getLinkedUserId(),
    mirrorEmail: getLinkedEmail(),
    mirrorDisplayName: getLinkedDisplayName(),
  };
}

export function wsPayloadToLinkPayload(raw: Record<string, unknown>): MirrorLinkPayload | null {
  const userId = (raw.userId ?? raw.user_id) as string | undefined;
  const mirrorToken = (raw.mirrorToken ?? raw.mirror_token) as string | undefined;
  if (!userId || !mirrorToken) return null;

  return {
    userId,
    mirrorToken,
    displayName: (raw.displayName ?? raw.display_name ?? null) as string | null,
    email: (raw.email ?? null) as string | null,
  };
}
