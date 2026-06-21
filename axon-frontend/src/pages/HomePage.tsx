import { useAuth } from "@/context/AuthProvider";
import { GreetingModule } from "@/features/greeting/GreetingModule";
import { DeviceLinkingScreen } from "@/features/device-linking/DeviceLinkingScreen";

/**
 * Center stage of the mirror. Renders the personalized greeting and leaves a
 * calm dynamic region for future intelligence (coach, briefings, photos) to
 * render into without disturbing the hero layout.
 * 
 * If user is not authenticated, shows device linking screen with QR code.
 */
export default function HomePage() {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-2xl text-glow">Loading...</div>
      </div>
    );
  }

  // If no user, show device linking screen
  if (!user) {
    return <DeviceLinkingScreen />;
  }

  // If authenticated, show normal home page
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
