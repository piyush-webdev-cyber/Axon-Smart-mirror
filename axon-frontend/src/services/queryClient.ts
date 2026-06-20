import { QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./apiClient";

/**
 * Shared TanStack Query client. Conservative retry policy keeps the Pi calm and
 * avoids hammering the backend when offline; auth errors never retry.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiClientError) {
          if (error.status === 401 || error.status === 403) return false;
          if (error.status === 501) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
