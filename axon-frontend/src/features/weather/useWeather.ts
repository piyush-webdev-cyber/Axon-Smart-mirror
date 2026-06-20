import type { WeatherSnapshot, WeatherStatus } from "./weather.types";

/**
 * Static placeholder reading. This is the ONLY thing a future phase replaces:
 * swap the constant for a fetcher that returns the same `WeatherSnapshot`.
 */
const PLACEHOLDER_SNAPSHOT: WeatherSnapshot = {
  temperature: 32,
  unit: "celsius",
  condition: "sunny",
  label: "Sunny",
  location: "Set location",
  feelsLike: 34,
  humidity: 41,
  high: 34,
  low: 26,
};

export interface UseWeatherResult {
  data: WeatherSnapshot | undefined;
  status: WeatherStatus;
  isPlaceholder: boolean;
}

/**
 * Weather data access seam.
 *
 * Phase 2 returns a static snapshot so the widget is fully realised. To go
 * live later, this hook becomes a TanStack Query call:
 *
 *   const { data, status } = useQuery({
 *     queryKey: queryKeys.weather(location),
 *     queryFn: () => fetchWeather(location),
 *   });
 *
 * Callers never change because the return contract is identical.
 */
export function useWeather(): UseWeatherResult {
  return {
    data: PLACEHOLDER_SNAPSHOT,
    status: "ready",
    isPlaceholder: true,
  };
}
