import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { env } from "@/utils/env";
import {
  fetchCurrentWeather,
  fetchCurrentWeatherAuto,
  fetchCurrentWeatherByCity,
} from "@/services/weatherApi";
import type { WeatherSnapshot, WeatherStatus } from "./weather.types";
import { useWeatherLocation } from "./useGeolocation";

export interface UseWeatherResult {
  data: WeatherSnapshot | undefined;
  status: WeatherStatus;
  isPlaceholder: boolean;
}

function buildQueryKey(coords: { lat: number; lon: number } | null, city: string): string {
  if (coords) return `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}`;
  if (city) return `city:${city}`;
  return "auto-ip";
}

/**
 * Live weather: device GPS → backend IP geolocation → optional env city.
 */
export function useWeather(): UseWeatherResult {
  const { coords, loading: geoLoading } = useWeatherLocation();
  const cityFallback = env.weatherCity.trim();

  const query = useQuery({
    queryKey: queryKeys.weather(buildQueryKey(coords, cityFallback)),
    queryFn: async (): Promise<WeatherSnapshot> => {
      if (coords) {
        return fetchCurrentWeather(coords.lat, coords.lon);
      }
      if (cityFallback) {
        try {
          return await fetchCurrentWeatherByCity(cityFallback);
        } catch {
          return fetchCurrentWeatherAuto();
        }
      }
      return fetchCurrentWeatherAuto();
    },
    enabled: !geoLoading,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });

  if (geoLoading || query.isLoading) {
    return { data: undefined, status: "loading", isPlaceholder: false };
  }

  if (query.isError) {
    return { data: undefined, status: "error", isPlaceholder: false };
  }

  if (query.data) {
    return { data: query.data, status: "ready", isPlaceholder: false };
  }

  return { data: undefined, status: "idle", isPlaceholder: false };
}
