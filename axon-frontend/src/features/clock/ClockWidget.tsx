import { useClock } from "./useClock";

/** Top-left region. Large, glanceable time legible from across the room. */
export function ClockWidget() {
  const { time, date } = useClock();

  return (
    <div className="flex flex-col">
      <span className="text-fluid-xl font-extralight leading-none tracking-tight text-glow tabular-nums">
        {time}
      </span>
      <span className="mt-1 text-fluid-base font-light text-muted-foreground">
        {date}
      </span>
    </div>
  );
}
