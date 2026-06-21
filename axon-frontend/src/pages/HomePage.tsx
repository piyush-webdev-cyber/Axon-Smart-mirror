import { useAuth } from "@/context/AuthProvider";
import { useAppStore } from "@/store";
import { GreetingModule } from "@/features/greeting/GreetingModule";
import { DeviceLinkingScreen } from "@/features/device-linking/DeviceLinkingScreen";
import { isMirrorLinked } from "@/utils/authToken";

export default function HomePage() {
  const { user, loading } = useAuth();
  const mirrorLinked = useAppStore((s) => s.mirrorLinked);
  const linked = mirrorLinked || isMirrorLinked();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-2xl text-glow">Loading...</div>
      </div>
    );
  }

  if (!user && !linked) {
    return <DeviceLinkingScreen />;
  }

  return (
    <section className="flex w-full flex-col items-center justify-center gap-[clamp(1rem,2.6vh,1.875rem)]">
      <GreetingModule />
      <div id="mirror-dynamic-region" aria-live="polite" className="contents" />
    </section>
  );
}
