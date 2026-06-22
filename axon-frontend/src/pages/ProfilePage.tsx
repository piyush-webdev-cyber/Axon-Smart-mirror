import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ROUTES, profilePath } from "@/constants/routes";
import { useAuth } from "@/context/AuthProvider";
import { useMirrorAuth } from "@/hooks/useMirrorAuth";
import { useAppStore } from "@/store";
import { getLinkedDeviceCode, isMirrorLinked } from "@/utils/authToken";

export default function ProfilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useAuth();
  const { linked: mirrorLinked, userId, email, displayName } = useMirrorAuth();
  const clearMirrorLink = useAppStore((s) => s.clearMirrorLink);

  const accountId = user?.id ?? userId ?? null;
  const accountEmail = user?.email ?? email ?? null;
  const accountLabel =
    user?.email?.split("@")[0] ??
    displayName ??
    email?.split("@")[0] ??
    accountId?.slice(0, 8) ??
    "Account";
  const deviceCode = getLinkedDeviceCode();

  if (!accountId) {
    return <Navigate to={ROUTES.home} replace />;
  }

  if (id !== accountId) {
    return <Navigate to={profilePath(accountId)} replace />;
  }

  const handleLogout = async () => {
    if (user) await signOut();
    if (mirrorLinked || isMirrorLinked()) clearMirrorLink();
    navigate(ROUTES.home, { replace: true });
  };

  return (
    <div className="flex w-full max-w-md animate-fade-in flex-col items-center">
      <div className="mb-6 flex w-full items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={ROUTES.home} aria-label="Back to mirror">
            <ArrowLeft />
          </Link>
        </Button>
        <h1 className="text-fluid-lg font-light tracking-wide">Account</h1>
      </div>

      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>{accountLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {deviceCode && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-text-secondary">
                Device code
              </p>
              <p className="text-center font-mono text-fluid-base font-semibold tracking-wider text-primary">
                {deviceCode}
              </p>
            </div>
          )}

          {accountEmail && (
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-wide text-text-secondary">
                Email
              </p>
              <p className="break-all text-center text-fluid-sm text-foreground">
                {accountEmail}
              </p>
            </div>
          )}

          <div>
            <p className="mb-1 text-[10px] uppercase tracking-wide text-text-secondary">
              User ID
            </p>
            <p className="break-all text-center font-mono text-caption text-text-secondary">
              {accountId}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-fluid-sm font-medium text-error transition-colors hover:bg-error/20"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
