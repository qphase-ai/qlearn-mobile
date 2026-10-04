import { QueryClient } from '@tanstack/react-query';

import { completeLesson } from '@/features/learning/api';
import { learningKeys } from '@/features/learning/keys';
import { isApiError } from '@/lib/api/errors';

import { LESSON_COMPLETE_MUTATION_KEY } from './persist';

const MAX_RETRIES = 2;

/**
 * Kept long for the offline cache (lib/query/persist.ts): a query
 * garbage-collected from memory is also dropped from disk on the next save.
 * Each launch rehydrates the persisted queries with a fresh gcTime, so 24 h
 * only has to outlast one app process; the whole cache still expires after
 * the persister's 7-day maxAge without a save.
 */
const GC_TIME_MS = 24 * 60 * 60_000;

/** Retry only transient failures; a 4xx won't fix itself. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  return isApiError(error) ? error.isRetryable : false;
}

export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: GC_TIME_MS,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
        // Fail fast offline (sign-in, password reset…) instead of pausing:
        // only lesson completion is queued, below.
        networkMode: 'always',
      },
    },
  });
  // Lets a completion restored from disk after a restart run: the persisted
  // mutation carries its key and variables, not its function or callbacks.
  // Hence the resync when it settles: a restored completion has no rollback,
  // so the progress refetch is what corrects a rejected one.
  client.setMutationDefaults(LESSON_COMPLETE_MUTATION_KEY, {
    mutationFn: completeLesson,
    networkMode: 'online',
    onSettled: () => client.invalidateQueries({ queryKey: learningKeys.progress() }),
  });
  return client;
}
