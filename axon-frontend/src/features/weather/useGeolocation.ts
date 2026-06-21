import { useEffect, useState } from "react";
import { env } from "@/utils/env";

export interface GeoCoords {
  lat: number;
  lon: number;
}

export type WeatherLocation =
  | { mode: "coords"; coords: GeoCoords }
  | { mode: "auto" };

interface UseWeatherLocationResult {
  location: WeatherLocation | null;
  error: string | null;
  loading: boolean;
}

function isElectronRuntime(): boolean {
  return Boolean(typeof window !== "undefined" && window.axonShell?.isElectron);
}

function readEnvOverride(): GeoCoords | null {
  if (env.weatherLat == null || env.weatherLon == null) return null;
  return { lat: env.weatherLat, lon: env.weatherLon };
}

function getBrowserPosition(): Promise<GeoCoords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (err) => reject(err),
      {
        enableHighAccuracy: false,
        timeout: 10_000,
        maximumAge: 5 * 60_000,
      },
    );
  });
}

/**
 * Mirror weather location:
 * 1. Optional env override (VITE_WEATHER_LAT/LON)
 * 2. Browser GPS (web only — skipped in Electron to avoid Google 403 noise)
 * 3. Backend IP geolocation via GET /weather/current (no query params)
 */
export function useWeatherLocation(): UseWeatherLocationResult {
  const [location, setLocation] = useState<WeatherLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function resolve(): Promise<void> {
      const override = readEnvOverride();
      if (override) {
        if (!cancelled) {
          setLocation({ mode: "coords", coords: override });
          setLoading(false);
        }
        return;
      }

      if (!isElectronRuntime()) {
        try {
          const coords = await getBrowserPosition();
          if (!cancelled) {
            setLocation({ mode: "coords", coords });
            setLoading(false);
            return;
          }
        } catch {
          /* fall through to IP-based location */
        }
      }

      if (!cancelled) {
        setLocation({ mode: "auto" });
        setLoading(false);
      }
    }

    void resolve().catch(() => {
      if (!cancelled) {
        setError("Unable to detect location.");
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, error, loading };
}

/** @deprecated use useWeatherLocation */
export function useGeolocation() {
  const { location, error, loading } = useWeatherLocation();
  return {
    coords: location?.mode === "coords" ? location.coords : null,
    error,
    loading,
  };
}
