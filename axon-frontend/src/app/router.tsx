import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { MirrorLayout } from "@/layouts/MirrorLayout";
import { RequireAuth } from "./RequireAuth";
import { ROUTES } from "@/constants/routes";
import { BrandedLoader } from "@/components/common/BrandedLoader";

// Route-based code splitting keeps the initial mirror bundle minimal on the Pi.
const HomePage = lazy(() => import("@/pages/HomePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const CallbackPage = lazy(() => import("@/pages/auth/CallbackPage"));

function lazyPage(node: React.ReactNode) {
  return <Suspense fallback={<BrandedLoader />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: ROUTES.home,
    element: <MirrorLayout />,
    children: [
      { index: true, element: lazyPage(<HomePage />) },
      {
        path: "settings",
        element: lazyPage(
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>,
        ),
      },
    ],
  },
  { path: ROUTES.login, element: lazyPage(<LoginPage />) },
  { path: ROUTES.callback, element: lazyPage(<CallbackPage />) },
  { path: "*", element: <Navigate to={ROUTES.home} replace /> },
]);
