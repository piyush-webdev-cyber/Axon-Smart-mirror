/** Device linking API client. */

import type { DeviceCode, DeviceLinkResponse, DeviceStatus } from "../types/device";
import { env } from "../utils/env";

const API_BASE = env.apiBaseUrl;

function parseApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  const detail = record.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

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

export const deviceApi = {
  /**
   * Create a new device code (mirror calls this on startup).
   * No authentication required.
   */
  async createDeviceCode(): Promise<DeviceCode> {
    const response = await fetch(`${API_BASE}/devices/codes`, {
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
    const response = await fetch(`${API_BASE}/devices/codes/${code}/status`);

    if (!response.ok) {
      throw new Error("Failed to check device status");
    }

    const data = (await response.json()) as Record<string, unknown>;
    return normalizeDeviceStatus(data);
  },

  /**
   * Link a device code to user account (phone calls this).
   * Requires authentication.
   */
  async linkDevice(code: string, accessToken: string): Promise<DeviceLinkResponse> {
    const response = await fetch(`${API_BASE}/devices/link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      throw new Error(parseApiError(body, "Failed to link device"));
    }

    const data = (await response.json()) as Record<string, unknown>;
    return normalizeDeviceLinkResponse(data);
  },
};
