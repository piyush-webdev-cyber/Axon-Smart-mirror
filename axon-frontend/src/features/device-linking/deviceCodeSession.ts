/** Single active device-code session — survives React Strict Mode double-mount. */

import { deviceApi, DeviceApiError } from "@/services/deviceApi";
import type { DeviceCode, DeviceStatus } from "@/types/device";
import { deviceApiBase } from "@/utils/deviceApiBase";
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

async function createAndPersistCode(): Promise<DeviceCode> {
  if (!inflightCreate) {
    const apiBase = deviceApiBase();
    // eslint-disable-next-line no-console
    console.info("[axon][deviceCode] creating code via", apiBase);
    inflightCreate = deviceApi
      .createDeviceCode()
      .then((created) => {
        const normalized = normalizeCode(created.code);
        sessionStorage.setItem(ACTIVE_DEVICE_CODE_KEY, normalized);
        // eslint-disable-next-line no-console
        console.info("[axon][deviceCode] saved", {
          code: normalized,
          apiBase,
          expires_at: created.expires_at,
        });
        return created;
      })
      .finally(() => {
        inflightCreate = null;
      });
  }
  return inflightCreate;
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
    // eslint-disable-next-line no-console
    console.info("[axon][deviceCode] reusing session code", {
      code: normalized,
      apiBase: deviceApiBase(),
    });
    try {
      const status = await deviceApi.checkDeviceStatus(normalized);
      if (status.status === "linked") {
        return { code: pendingCodeRecord(normalized), alreadyLinked: status };
      }
      if (status.status === "pending") {
        return { code: pendingCodeRecord(normalized) };
      }
      sessionStorage.removeItem(ACTIVE_DEVICE_CODE_KEY);
    } catch (err) {
      // Stale code (backend restart, expiry, or wrong API) — discard and mint fresh.
      sessionStorage.removeItem(ACTIVE_DEVICE_CODE_KEY);
      if (!(err instanceof DeviceApiError) || err.status === 404) {
        console.warn("[axon] Discarding stale device code, creating new one");
      }
    }
  }

  const created = await createAndPersistCode();
  return { code: created };
}

/** Replace the active code when polling discovers the backend no longer knows it. */
export async function refreshDeviceCode(): Promise<DeviceCode> {
  sessionStorage.removeItem(ACTIVE_DEVICE_CODE_KEY);
  inflightCreate = null;
  const created = await createAndPersistCode();
  return created;
}

export function clearActiveDeviceCode(): void {
  sessionStorage.removeItem(ACTIVE_DEVICE_CODE_KEY);
  inflightCreate = null;
}
