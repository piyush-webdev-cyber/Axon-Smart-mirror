import { useEffect, useState } from "react";

export interface GeoCoords {
  lat: number;
  lon: number;
}

interface UseGeolocationResult {
  coords: GeoCoords | null;
  error: string | null;
  loading: boolean;
}

/**
 * One-shot browser geolocation for the mirror weather widget.
 * Caches the result for the session to avoid repeated permission prompts.
 */
export function useGeolocation(): UseGeolocationResult {
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Location is not supported on this device.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setLoading(false);
      },
      (positionError) => {
        setError(positionError.message || "Unable to detect location.");
        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 10 * 60_000,
      },
    );
  }, []);

  return { coords, error, loading };
}
