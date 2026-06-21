import { useNavigate } from "react-router-dom";
import { BrandedLoader } from "@/components/common/BrandedLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useMirrorAuth } from "@/hooks/useMirrorAuth";
import { useAppStore } from "@/store";
import { DeviceLinkingScreen } from "@/features/device-linking/DeviceLinkingScreen";
import { isMirrorLinked } from "@/utils/authToken";

export default function LoginPage() {
  const { user, loading, signOut } = useAuth();
  const { linked: mirrorLinked, userId: mirrorUserId, email: mirrorEmail, displayName } =
    useMirrorAuth();
  const clearMirrorLink = useAppStore((s) => s.clearMirrorLink);
  const navigate = useNavigate();

  if (loading) {
    return <BrandedLoader label="Loading" fullscreen={false} />;
  }

  if (!user && !mirrorLinked && !isMirrorLinked()) {
    return <DeviceLinkingScreen />;
  }

  const handleLogout = async () => {
    if (user) {
      await signOut();
    }
    if (mirrorLinked || isMirrorLinked()) {
      clearMirrorLink();
    }
    navigate(ROUTES.home, { replace: true });
  };

  const accountId = user?.id ?? mirrorUserId ?? "";
  const accountEmail = user?.email ?? mirrorEmail ?? null;

  return (
    <div className="flex w-full items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <CardTitle className="text-center text-fluid-lg font-extralight tracking-[0.4em] uppercase text-glow">
            Axon
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 text-center">
          <div>
            <p className="mb-2 text-fluid-sm text-muted-foreground">Connected as</p>
            {displayName && !user && (
              <p className="mb-2 text-fluid-base font-medium text-foreground">{displayName}</p>
            )}
            <p className="break-all font-mono text-fluid-sm text-primary">{accountId}</p>
            {accountEmail && (
              <p className="mt-2 text-fluid-sm text-muted-foreground">{accountEmail}</p>
            )}
          </div>

          <Button variant="outline" onClick={() => void handleLogout()}>
            Disconnect mirror
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
