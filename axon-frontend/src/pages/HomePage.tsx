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
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-2xl text-glow">Loading...</div>
      </div>
    );
  }

  if (!user && !linked) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <DeviceLinkingScreen />
      </div>
    );
  }

  return (
    <section className="flex h-full w-full flex-col items-center justify-center text-center">
      <GreetingModule />
      <div id="mirror-dynamic-region" aria-live="polite" className="contents" />
    </section>
  );
}
