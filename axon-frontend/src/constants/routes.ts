/** Centralized route paths. Import these instead of hardcoding strings. */
export const ROUTES = {
  home: "/",
  settings: "/settings",
  camera: "/camera",
  gallery: "/gallery",
  music: "/music",
  gallerySession: "/gallery/session/:token",
  profile: "/profile/:id",
  link: "/link/:code",
  auth: "/auth",
  login: "/auth/login",
  callback: "/auth/callback",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];

export function profilePath(userId: string) {
  return `/profile/${encodeURIComponent(userId)}`;
}
