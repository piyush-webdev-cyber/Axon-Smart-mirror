import { useEffect, useState } from "react";
import { env } from "@/utils/env";

export interface GeoCoords {
  lat: number;
  lon: number;
}

interface UseWeatherLocationResult {
  coords: GeoCoords | null;
  loading: boolean;
}

const CACHE_KEY = "axon_weather_coords_v3";
const CACHE_MAX_AGE_MS = 6 * 60 * 60_000;

function readEnvOverride(): GeoCoords | null {
  if (env.weatherLat == null || env.weatherLon == null) return null;
  return { lat: env.weatherLat, lon: env.weatherLon };
}

function readCachedCoords(): GeoCoords | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lat: number; lon: number; at: number };
    if (Date.now() - parsed.at > CACHE_MAX_AGE_MS) return null;
    if (!Number.isFinite(parsed.lat) || !Number.isFinite(parsed.lon)) return null;
    return { lat: parsed.lat, lon: parsed.lon };
  } catch {
    return null;
  }
}

function cacheCoords(coords: GeoCoords): void {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ lat: coords.lat, lon: coords.lon, at: Date.now() }),
    );
  } catch {
    /* noop */
  }
}

function getDevicePosition(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => reject(new Error("denied")),
      {
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge: 10 * 60_000,
      },
    );
  });
}

/**
 * Optional device GPS coords. Weather still loads via backend IP/city if this fails.
 */
export function useWeatherLocation(): UseWeatherLocationResult {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolve(): Promise<void> {
      const override = readEnvOverride();
      if (override) {
        if (!cancelled) {
          setCoords(override);
          setLoading(false);
        }
        return;
      }

      const cached = readCachedCoords();
      if (cached && !cancelled) {
        setCoords(cached);
        setLoading(false);
      }

      try {
        const live = await getDevicePosition();
        cacheCoords(live);
        if (!cancelled) setCoords(live);
      } catch {
        if (!cancelled && !cached) setCoords(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  return { coords, loading };
}

/** @deprecated use useWeatherLocation */
export function useGeolocation() {
  const { coords, loading } = useWeatherLocation();
  return { coords, error: null, loading };
}
