/** Device linking API client. */

import type { DeviceCode, DeviceLinkResponse, DeviceStatus } from "../types/device";
import { env } from "../utils/env";

function deviceApiBase(): string {
  if (
    typeof window !== "undefined" &&
    window.axonShell?.isElectron &&
    import.meta.env.VITE_VOICE_ENGINE === "native"
  ) {
    return "http://127.0.0.1:8010/api/v1";
  }
  return env.apiBaseUrl;
}

export class DeviceApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DeviceApiError";
    this.status = status;
  }
}

function parseApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (typeof detail === "object" && detail && "message" in detail) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (typeof first === "object" && first && "msg" in first) {
      const msg = (first as { msg?: unknown }).msg;
      if (typeof msg === "string" && msg.trim()) return msg;
    }
  }

  const nested = record.error;
  if (typeof nested === "object" && nested && "message" in nested) {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message;
  }

  return fallback;
}

function logDeviceRequest(method: string, url: string, payload?: unknown): void {
  // eslint-disable-next-line no-console
  console.info("[axon][deviceApi] request", { method, url, payload });
}

function logDeviceResponse(method: string, url: string, status: number, body: unknown): void {
  // eslint-disable-next-line no-console
  console.info("[axon][deviceApi] response", { method, url, status, body });
}

function logDeviceError(method: string, url: string, error: unknown): void {
  // eslint-disable-next-line no-console
  console.error("[axon][deviceApi] error", {
    method,
    url,
    error,
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function normalizeDeviceStatus(raw: Record<string, unknown>): DeviceStatus {
  return {
    status: raw.status as DeviceStatus["status"],
    user_id: (raw.user_id ?? raw.userId ?? null) as string | null,
    display_name: (raw.display_name ?? raw.displayName ?? null) as string | null,
    avatar_url: (raw.avatar_url ?? raw.avatarUrl ?? null) as string | null,
    email: (raw.email ?? null) as string | null,
    mirror_token: (raw.mirror_token ?? raw.mirrorToken ?? null) as string | null,
  };
}

function normalizeDeviceLinkResponse(raw: Record<string, unknown>): DeviceLinkResponse {
  return {
    success: Boolean(raw.success),
    message: String(raw.message ?? ""),
    user_id: (raw.user_id ?? raw.userId ?? null) as string | null,
    display_name: (raw.display_name ?? raw.displayName ?? null) as string | null,
    email: (raw.email ?? null) as string | null,
    mirror_token: (raw.mirror_token ?? raw.mirrorToken ?? null) as string | null,
  };
}

async function deviceFetch(
  path: string,
  init: RequestInit,
): Promise<Response> {
  const base = deviceApiBase();
  const url = `${base}${path}`;
  const method = init.method ?? "GET";

  logDeviceRequest(method, url, (() => {
    if (!init.body) return undefined;
    try {
      return JSON.parse(String(init.body));
    } catch {
      return init.body;
    }
  })());

  try {
    const response = await fetch(url, init);
    const clone = response.clone();
    const body: unknown = await clone.json().catch(() => null);
    logDeviceResponse(method, url, response.status, body);
    return response;
  } catch (error) {
    logDeviceError(method, url, error);
    throw error;
  }
}

export const deviceApi = {
  /**
   * Create a new device code (mirror calls this on startup).
   * No authentication required.
   */
  async createDeviceCode(): Promise<DeviceCode> {
    const response = await deviceFetch("/devices/codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error("Failed to create device code");
    }

    return response.json();
  },

  /**
   * Check device code status (mirror polls this).
   * No authentication required.
   */
  async checkDeviceStatus(code: string): Promise<DeviceStatus> {
    const response = await deviceFetch(
      `/devices/codes/${encodeURIComponent(code)}/status`,
      { method: "GET" },
    );

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new DeviceApiError(
        parseApiError(body, "Failed to check device status"),
        response.status,
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return normalizeDeviceStatus(data);
  },

  /**
   * Link a device code to user account (phone calls this).
   * Requires authentication.
   */
  async linkDevice(code: string, accessToken: string): Promise<DeviceLinkResponse> {
    const payload = { code };
    const response = await deviceFetch("/devices/link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new Error(parseApiError(body, "Failed to link device"));
    }

    const data = (await response.json()) as Record<string, unknown>;
    return normalizeDeviceLinkResponse(data);
  },
};
