import { useEffect, useState } from "react";

interface ClockValue {
  time: string;
  date: string;
}

interface UseClockOptions {
  hour12?: boolean;
  locale?: string;
}

/** Ticks once per second and returns formatted time + date strings. */
export function useClock({
  hour12 = false,
  locale = "en-US",
}: UseClockOptions = {}): ClockValue {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12,
  });

  const date = now.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return { time, date };
}
