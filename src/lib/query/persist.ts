import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { hashKey, type Mutation, type Query } from '@tanstack/react-query';
import type { PersistQueryClientOptions, PersistedClient, Persister } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import Storage from 'expo-sqlite/kv-store';
import * as Updates from 'expo-updates';

import { getSupabase } from '@/lib/supabase/client';

/**
 * Offline cache: the curriculum and progress a student has already opened stay
 * readable without a network, and a lesson completion made offline survives a
 * restart. Everything else (profile, tutor transcripts, search) is memory-only.
 */

export const PERSIST_KEY = 'qlearn.query-cache';
/** Bump when a persisted query's shape changes, so an OTA update busts old caches. */
export const CACHE_SCHEMA = 1;
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60_000;

/** `learningKeys` roots (features/learning/hooks.ts) that may be written to disk. */
const PERSISTED_LEARNING_ROOTS = new Set(['courses', 'course', 'lesson', 'progress']);

/** The only queued write: idempotent (`PUT`), with a mutationFn registered via setMutationDefaults. */
export const LESSON_COMPLETE_MUTATION_KEY = ['lesson-progress', 'complete'] as const;

export function shouldPersistQuery(query: Pick<Query, 'queryKey' | 'state'>): boolean {
  const [scope, root] = query.queryKey;
  return (
    query.state.status === 'success' &&
    scope === 'learning' &&
    typeof root === 'string' &&
    PERSISTED_LEARNING_ROOTS.has(root)
  );
}

export function shouldPersistMutation(mutation: Pick<Mutation, 'options' | 'state'>): boolean {
  const key = mutation.options.mutationKey;
  return mutation.state.isPaused && !!key && hashKey(key) === hashKey(LESSON_COMPLETE_MUTATION_KEY);
}

/** The persisted blob, stamped with the account it belongs to. */
type OwnedClient = PersistedClient & { ownerId?: string };

const isEmpty = (client: PersistedClient) =>
  client.clientState.queries.length === 0 && client.clientState.mutations.length === 0;

const EMPTY = '';

const basePersister = createAsyncStoragePersister({
  // An empty cache (signed out, or the save that trails a sign-out) removes
  // the key instead of writing it. This goes through the persister's
  // throttle, so it can't be overtaken by an older save still waiting there.
  storage: {
    getItem: (key) => Storage.getItem(key),
    setItem: (key, value: string) => (value === EMPTY ? Storage.removeItem(key) : Storage.setItem(key, value)),
    removeItem: (key) => Storage.removeItem(key),
  },
  key: PERSIST_KEY,
  serialize: (client) => (isEmpty(client) ? EMPTY : JSON.stringify(client)),
});

/** Signed-in user the cache belongs to; kept current by AuthProvider. */
let owner: string | null = null;

export function setPersistOwner(userId: string | null): void {
  owner = userId;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await getSupabase().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Per-account: every save carries the owner, nothing is saved while signed
 * out, and a restore only hydrates a cache owned by the session on this
 * device. That check runs before hydration, so a queued completion from
 * another account can never be resumed with this account's token.
 */
export const queryPersister: Persister = {
  persistClient: (client) => {
    const owned: OwnedClient = owner
      ? { ...client, ownerId: owner }
      : { ...client, clientState: { queries: [], mutations: [] } };
    return basePersister.persistClient(owned);
  },
  restoreClient: async () => {
    const persisted = (await basePersister.restoreClient()) as OwnedClient | undefined;
    if (!persisted) return undefined;
    const userId = await currentUserId();
    if (!userId || persisted.ownerId !== userId) {
      await basePersister.removeClient();
      return undefined;
    }
    setPersistOwner(userId);
    return persisted;
  },
  removeClient: () => basePersister.removeClient(),
};

// The fingerprint policy is resolved at build time, so only the native module
// knows the value. It reports '' while expo-updates is disabled.
const runtimeVersion = Updates.runtimeVersion || '';

export const persistOptions: Omit<PersistQueryClientOptions, 'queryClient'> = {
  persister: queryPersister,
  maxAge: PERSIST_MAX_AGE_MS,
  // A new app version, native runtime or cache schema may change cached
  // shapes: start from an empty cache.
  buster: [
    Constants.expoConfig?.version ?? 'dev',
    runtimeVersion,
    CACHE_SCHEMA,
  ].join('|'),
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersistQuery,
    shouldDehydrateMutation: shouldPersistMutation,
  },
};

/** Wipe the on-disk cache (sign-out). The in-memory client is cleared separately. */
export async function clearPersistedCache(): Promise<void> {
  await basePersister.removeClient();
}
