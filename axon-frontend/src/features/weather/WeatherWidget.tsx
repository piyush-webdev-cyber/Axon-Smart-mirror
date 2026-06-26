import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  MapPin,
  Snowflake,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useWeather } from "./useWeather";
import type { WeatherCondition } from "./weather.types";

const CONDITION_ICON: Record<WeatherCondition, LucideIcon> = {
  clear: Sun,
  sunny: Sun,
  "partly-cloudy": CloudSun,
  cloudy: Cloud,
  rain: CloudRain,
  drizzle: CloudDrizzle,
  thunderstorm: CloudLightning,
  snow: Snowflake,
  fog: CloudFog,
  wind: Wind,
  unknown: Cloud,
};

const UNIT_SYMBOL = { celsius: "C", fahrenheit: "F" } as const;

/**
 * Top-right region. Fully realised weather UI driven by the `useWeather` seam.
 * Phase 2 renders a static snapshot; wiring a live provider requires zero
 * changes here (see useWeather).
 */
export function WeatherWidget() {
  const { data, status } = useWeather();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 text-right">
        <div className="flex flex-col items-end">
          <span className="text-display-lg tabular-nums text-content-muted">…</span>
          <span className="text-caption uppercase text-content-muted">Loading weather</span>
        </div>
        <Cloud className="size-9 animate-pulse text-content-muted" strokeWidth={1.25} />
      </div>
    );
  }

  if (status !== "ready" || !data) {
    return (
      <div className="flex items-center gap-3 text-right">
        <div className="flex flex-col items-end">
          <span className="text-display-lg tabular-nums text-content-muted">
            --&deg;
          </span>
          <span className="text-caption uppercase text-content-muted">
            Weather offline
          </span>
        </div>
        <Cloud className="size-9 text-content-muted" strokeWidth={1.25} />
      </div>
    );
  }

  const Icon = CONDITION_ICON[data.condition];

  const formatDay = (isoDay: string) => {
    const date = new Date(`${isoDay}T12:00:00`);
    return date.toLocaleDateString(undefined, { weekday: "short" });
  };

  return (
    <div className="flex flex-col items-end animate-fade-in-down">
      <div className="flex items-start text-right">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 leading-none">
            <span className="text-display-lg tabular-nums font-semibold text-content">
              {data.temperature}&deg;{UNIT_SYMBOL[data.unit]}
            </span>
            <span className="text-content-muted">-</span>
            <Icon className="size-8 text-content-muted" strokeWidth={1.5} aria-hidden />
          </div>
          <span className="mt-1 text-subheading font-semibold text-content">
            {data.label}
          </span>
          <span className="mt-1 flex items-center justify-end gap-1 text-caption uppercase tracking-[0.12em] text-content-muted">
            <MapPin className="size-3" strokeWidth={1.5} aria-hidden />
            {data.location}
          </span>
          {data.high != null && data.low != null ? (
            <span className="mt-1 text-caption text-content-muted">
              H {data.high}&deg; · L {data.low}&deg;
            </span>
          ) : null}
        </div>
      </div>
      {data.forecast && data.forecast.length > 0 ? (
        <div className="mt-3 flex gap-3">
          {data.forecast.map((day) => {
            const DayIcon = CONDITION_ICON[day.condition] ?? Cloud;
            return (
              <div key={day.day} className="flex flex-col items-center text-caption text-content-muted">
                <span className="uppercase tracking-wide">{formatDay(day.day)}</span>
                <DayIcon className="my-1 size-5" strokeWidth={1.25} aria-hidden />
                <span className="tabular-nums">
                  {day.high}&deg; / {day.low}&deg;
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
