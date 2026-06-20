/**
 * Central TanStack Query key factory. Keeps cache keys consistent and
 * refactor-safe across the app.
 */
export const queryKeys = {
  health: ["health"] as const,
  system: {
    info: ["system", "info"] as const,
    status: ["system", "status"] as const,
  },
  user: {
    me: ["user", "me"] as const,
    settings: ["user", "me", "settings"] as const,
  },
  weather: (location: string) => ["weather", location] as const,
} as const;
