/** Single active device-code session — survives React Strict Mode double-mount. */

import { deviceApi } from "@/services/deviceApi";
import type { DeviceCode, DeviceStatus } from "@/types/device";
import { isMirrorLinked } from "@/utils/authToken";
import { ACTIVE_DEVICE_CODE_KEY } from "@/utils/mirrorLink";

let inflightCreate: Promise<DeviceCode> | null = null;

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function pendingCodeRecord(code: string): DeviceCode {
  return {
    id: code,
    code,
    status: "pending",
    expires_at: "",
    created_at: "",
  };
}

/** Reuse sessionStorage code or share one in-flight create across mounts. */
export async function acquireDeviceCode(): Promise<{
  code: DeviceCode;
  alreadyLinked?: DeviceStatus;
}> {
  if (isMirrorLinked()) {
    throw new Error("Mirror already linked");
  }

  const saved = sessionStorage.getItem(ACTIVE_DEVICE_CODE_KEY);
  if (saved) {
    const normalized = normalizeCode(saved);
    try {
      const status = await deviceApi.checkDeviceStatus(normalized);
      if (status.status === "linked") {
        return { code: pendingCodeRecord(normalized), alreadyLinked: status };
      }
      if (status.status === "pending") {
        return { code: pendingCodeRecord(normalized) };
      }
      sessionStorage.removeItem(ACTIVE_DEVICE_CODE_KEY);
    } catch {
      return { code: pendingCodeRecord(normalized) };
    }
  }

  if (!inflightCreate) {
    inflightCreate = deviceApi
      .createDeviceCode()
      .then((created) => {
        sessionStorage.setItem(ACTIVE_DEVICE_CODE_KEY, normalizeCode(created.code));
        return created;
      })
      .finally(() => {
        inflightCreate = null;
      });
  }

  const created = await inflightCreate;
  return { code: created };
}

export function clearActiveDeviceCode(): void {
  sessionStorage.removeItem(ACTIVE_DEVICE_CODE_KEY);
  inflightCreate = null;
}
