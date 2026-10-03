import { QueryClient } from '@tanstack/react-query';

import { isApiError } from '@/lib/api/errors';

const MAX_RETRIES = 2;

/** Retry only transient failures; a 4xx won't fix itself. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return isApiError(error) ? error.isRetryable : false;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
