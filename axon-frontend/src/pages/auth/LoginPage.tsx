import { useNavigate } from "react-router-dom";
import { BrandedLoader } from "@/components/common/BrandedLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { DeviceLinkingScreen } from "@/features/device-linking/DeviceLinkingScreen";

/**
 * Mirror account surface. Unlinked / signed-out users see the device QR code;
 * signed-in users see their account id and can log out.
 */
export default function LoginPage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <BrandedLoader label="Loading" fullscreen={false} />;
  }

  if (!user) {
    return <DeviceLinkingScreen />;
  }

  const handleLogout = async () => {
    await signOut();
    navigate(ROUTES.home, { replace: true });
  };

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
            <p className="mb-2 text-fluid-sm text-muted-foreground">Signed in as</p>
            <p className="break-all font-mono text-fluid-sm text-primary">{user.id}</p>
            {user.email && (
              <p className="mt-2 text-fluid-sm text-muted-foreground">{user.email}</p>
            )}
          </div>

          <Button variant="outline" onClick={() => void handleLogout()}>
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
