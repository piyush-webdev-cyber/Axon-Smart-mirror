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

const WEATHER_CACHE_KEY = "axon_weather_cache";

function readWeatherCache(): WeatherSnapshot | undefined {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as WeatherSnapshot;
  } catch {
    return undefined;
  }
}

function writeWeatherCache(snapshot: WeatherSnapshot): void {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota or private mode */
  }
}

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
      let snapshot: WeatherSnapshot;
      if (coords) {
        snapshot = await fetchCurrentWeather(coords.lat, coords.lon);
      } else if (cityFallback) {
        try {
          snapshot = await fetchCurrentWeatherByCity(cityFallback);
        } catch {
          snapshot = await fetchCurrentWeatherAuto();
        }
      } else {
        snapshot = await fetchCurrentWeatherAuto();
      }
      writeWeatherCache(snapshot);
      return snapshot;
    },
    enabled: !geoLoading,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
    placeholderData: readWeatherCache,
  });

  if (geoLoading || query.isLoading) {
    const cached = readWeatherCache();
    if (cached) {
      return { data: cached, status: "ready", isPlaceholder: true };
    }
    return { data: undefined, status: "loading", isPlaceholder: false };
  }

  if (query.isError) {
    const cached = readWeatherCache();
    if (cached) {
      return { data: cached, status: "ready", isPlaceholder: true };
    }
    return { data: undefined, status: "error", isPlaceholder: false };
  }

  if (query.data) {
    return { data: query.data, status: "ready", isPlaceholder: false };
  }

  return { data: undefined, status: "idle", isPlaceholder: false };
}
