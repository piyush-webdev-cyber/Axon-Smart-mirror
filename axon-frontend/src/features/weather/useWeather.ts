import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import {
  fetchCurrentWeather,
  fetchCurrentWeatherAuto,
} from "@/services/weatherApi";
import type { WeatherSnapshot, WeatherStatus } from "./weather.types";
import { useWeatherLocation, type WeatherLocation } from "./useGeolocation";

export interface UseWeatherResult {
  data: WeatherSnapshot | undefined;
  status: WeatherStatus;
  isPlaceholder: boolean;
}

function locationQueryKey(location: WeatherLocation): string {
  if (location.mode === "coords") {
    return `${location.coords.lat.toFixed(3)},${location.coords.lon.toFixed(3)}`;
  }
  return "auto";
}

/**
 * Live weather — GPS when available, otherwise backend IP geolocation.
 */
export function useWeather(): UseWeatherResult {
  const { location, error: geoError, loading: geoLoading } = useWeatherLocation();

  const query = useQuery({
    queryKey: queryKeys.weather(location ? locationQueryKey(location) : "unknown"),
    queryFn: () => {
      if (!location) throw new Error("No weather location");
      return location.mode === "coords"
        ? fetchCurrentWeather(location.coords.lat, location.coords.lon)
        : fetchCurrentWeatherAuto();
    },
    enabled: !!location,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });

  if (geoLoading || (location && query.isLoading)) {
    return { data: undefined, status: "loading", isPlaceholder: false };
  }

  if (geoError || query.isError) {
    return { data: undefined, status: "error", isPlaceholder: false };
  }

  if (query.data) {
    return { data: query.data, status: "ready", isPlaceholder: false };
  }

  return { data: undefined, status: "idle", isPlaceholder: false };
}
