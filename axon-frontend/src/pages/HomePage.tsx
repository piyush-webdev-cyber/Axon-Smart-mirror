import { GreetingModule } from "@/features/greeting/GreetingModule";

/**
 * Center stage of the mirror. Renders the personalized greeting and leaves a
 * calm dynamic region for future intelligence (coach, briefings, photos) to
 * render into without disturbing the hero layout.
 */
export default function HomePage() {
  return (
    <section className="flex w-full flex-col items-center justify-center gap-[clamp(1rem,2.6vh,1.875rem)]">
      <GreetingModule />

      {/* Future dynamic content region - intentionally empty until populated. */}
      <div
        id="mirror-dynamic-region"
        aria-live="polite"
        className="contents"
      />
    </section>
  );
}
