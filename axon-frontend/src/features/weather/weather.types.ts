/**
 * Weather domain model. Phase 2 ships the full UI against this contract using a
 * static source; a future phase swaps in a real provider (e.g. Open-Meteo) by
 * implementing the same `WeatherSnapshot` shape - no UI changes required.
 */

/** Normalized, provider-agnostic condition buckets the UI knows how to render. */
export type WeatherCondition =
  | "clear"
  | "sunny"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "drizzle"
  | "thunderstorm"
  | "snow"
  | "fog"
  | "wind"
  | "unknown";

export type TemperatureUnit = "celsius" | "fahrenheit";

export interface ForecastDay {
  day: string;
  high: number;
  low: number;
  condition: WeatherCondition;
  label: string;
}

export interface WeatherSnapshot {
  /** Whole-number temperature in the unit below. */
  temperature: number;
  unit: TemperatureUnit;
  condition: WeatherCondition;
  /** Human label, e.g. "Sunny", "Partly Cloudy". */
  label: string;
  /** Display location, e.g. "Bengaluru, IN". */
  location: string;
  /** Optional extras a real provider will populate. */
  feelsLike?: number;
  humidity?: number;
  high?: number;
  low?: number;
  /** ISO timestamp of the reading. */
  observedAt?: string;
  forecast?: ForecastDay[];
}

export type WeatherStatus = "idle" | "loading" | "ready" | "error";
