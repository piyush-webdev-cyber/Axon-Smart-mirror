import { useEffect, useState } from "react";

export interface ClockValue {
  /** Time without the day-period, e.g. "09:45" (or "09:45:07" with seconds). */
  time: string;
  /** "AM" | "PM" in 12-hour mode, otherwise an empty string. */
  period: string;
  /** Pre-formatted "Friday, June 20". */
  date: string;
  /** Changes only when the rendered minute changes, so widgets can replay a
   *  subtle transition on tick instead of re-animating every second. */
  minuteKey: string;
  hour12: boolean;
}

interface UseClockOptions {
  hour12?: boolean;
  showSeconds?: boolean;
  locale?: string;
}

/**
 * Single source of truth for live time. Ticks once per second and returns
 * locale-aware, fully formatted strings with the day-period split out so the
 * UI can typeset "09:45" large and "AM" as a quiet superscript.
 */
export function useClock({
  hour12 = true,
  showSeconds = false,
  locale = "en-US",
}: UseClockOptions = {}): ClockValue {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeParts = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" as const } : {}),
    hour12,
  }).formatToParts(now);

  const period =
    timeParts.find((p) => p.type === "dayPeriod")?.value.toUpperCase() ?? "";

  const time = timeParts
    .filter((p) => p.type !== "dayPeriod" && p.type !== "literal")
    .map((p) => p.value)
    .join(":");

  const date = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const minuteKey = `${now.getHours()}:${now.getMinutes()}`;

  return { time, date, period, minuteKey, hour12 };
}
