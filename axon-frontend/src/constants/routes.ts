/** Centralized route paths. Import these instead of hardcoding strings. */
export const ROUTES = {
  home: "/",
  settings: "/settings",
  auth: "/auth",
  login: "/auth/login",
  callback: "/auth/callback",
} as const;

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES];
