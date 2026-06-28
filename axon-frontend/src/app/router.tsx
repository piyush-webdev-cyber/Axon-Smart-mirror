import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { MirrorLayout } from "@/layouts/MirrorLayout";
import { RequireAuth } from "./RequireAuth";
import { ROUTES } from "@/constants/routes";
import { BrandedLoader } from "@/components/common/BrandedLoader";

// Route-based code splitting keeps the initial mirror bundle minimal on the Pi.
const HomePage = lazy(() => import("@/pages/HomePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const CameraPage = lazy(() => import("@/pages/CameraPage"));
const GalleryPage = lazy(() => import("@/pages/GalleryPage"));
const MusicPage = lazy(() => import("@/pages/MusicPage"));
const GallerySessionPage = lazy(() => import("@/pages/GallerySessionPage"));
const LinkPage = lazy(() => import("@/pages/LinkPage"));
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
      {
        path: "profile/:id",
        element: lazyPage(
          <RequireAuth>
            <ProfilePage />
          </RequireAuth>,
        ),
      },
      {
        path: "camera",
        element: lazyPage(
          <RequireAuth>
            <CameraPage />
          </RequireAuth>,
        ),
      },
      {
        path: "gallery",
        element: lazyPage(
          <RequireAuth>
            <GalleryPage />
          </RequireAuth>,
        ),
      },
      {
        path: "music",
        element: lazyPage(
          <RequireAuth>
            <MusicPage />
          </RequireAuth>,
        ),
      },
      { path: "auth/login", element: lazyPage(<LoginPage />) },
    ],
  },
  { path: "/link/:code", element: lazyPage(<LinkPage />) },
  {
    path: ROUTES.gallerySession,
    element: lazyPage(<GallerySessionPage />),
  },
  { path: ROUTES.callback, element: lazyPage(<CallbackPage />) },
  { path: "*", element: <Navigate to={ROUTES.home} replace /> },
]);
