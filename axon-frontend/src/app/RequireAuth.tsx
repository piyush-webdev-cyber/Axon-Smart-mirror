import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/context/AuthProvider";
import { ROUTES } from "@/constants/routes";
import { BrandedLoader } from "@/components/common/BrandedLoader";

/**
 * Guards non-mirror routes (e.g. Settings). The mirror home view stays public
 * so the device always displays something; authenticated surfaces are gated.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <BrandedLoader label="Axon" />;
  if (!session) {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }
  return <>{children}</>;
}
