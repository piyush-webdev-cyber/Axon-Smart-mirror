/** OpenWeather-backed weather client (via Axon backend proxy). */

import type { WeatherSnapshot } from "@/features/weather/weather.types";
import { env } from "@/utils/env";

const API_BASE = env.apiBaseUrl;

function parseApiError(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;

  const record = body as Record<string, unknown>;
  const nested = record.error;
  if (typeof nested === "object" && nested && "message" in nested) {
    const message = (nested as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  if (typeof record.detail === "string" && record.detail.trim()) {
    return record.detail;
  }

  return fallback;
}

function normalizeSnapshot(raw: Record<string, unknown>): WeatherSnapshot {
  return {
    temperature: Number(raw.temperature ?? 0),
    unit: (raw.unit as WeatherSnapshot["unit"]) ?? "celsius",
    condition: (raw.condition as WeatherSnapshot["condition"]) ?? "unknown",
    label: String(raw.label ?? "Unknown"),
    location: String(raw.location ?? "Unknown"),
    feelsLike:
      raw.feels_like != null
        ? Number(raw.feels_like)
        : raw.feelsLike != null
          ? Number(raw.feelsLike)
          : undefined,
    humidity: raw.humidity != null ? Number(raw.humidity) : undefined,
    high: raw.high != null ? Number(raw.high) : undefined,
    low: raw.low != null ? Number(raw.low) : undefined,
    observedAt:
      typeof raw.observed_at === "string"
        ? raw.observed_at
        : typeof raw.observedAt === "string"
          ? raw.observedAt
          : undefined,
  };
}

export async function fetchCurrentWeather(
  lat: number,
  lon: number,
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
  });

  const response = await fetch(`${API_BASE}/weather/current?${params}`);

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new Error(parseApiError(body, "Failed to load weather"));
  }

  const data = (await response.json()) as Record<string, unknown>;
  return normalizeSnapshot(data);
}
