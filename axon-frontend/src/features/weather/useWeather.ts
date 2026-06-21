import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/constants/queryKeys";
import { fetchCurrentWeather } from "@/services/weatherApi";
import type { WeatherSnapshot, WeatherStatus } from "./weather.types";
import { useGeolocation } from "./useGeolocation";

export interface UseWeatherResult {
  data: WeatherSnapshot | undefined;
  status: WeatherStatus;
  isPlaceholder: boolean;
}

/**
 * Live weather for the mirror — uses device geolocation + OpenWeather via backend.
 */
export function useWeather(): UseWeatherResult {
  const { coords, error: geoError, loading: geoLoading } = useGeolocation();

  const query = useQuery({
    queryKey: queryKeys.weather(
      coords ? `${coords.lat.toFixed(3)},${coords.lon.toFixed(3)}` : "unknown",
    ),
    queryFn: () => fetchCurrentWeather(coords!.lat, coords!.lon),
    enabled: !!coords,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 1,
  });

  if (geoLoading || (coords && query.isLoading)) {
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
