import { dehydrate, onlineManager, QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
  persistQueryClientSubscribe,
} from '@tanstack/react-query-persist-client';

import { learningKeys } from '@/features/learning/keys';
import { profileKeys } from '@/features/profile/hooks';

import {
  clearPersistedCache,
  LESSON_COMPLETE_MUTATION_KEY,
  PERSIST_KEY,
  persistOptions,
  setPersistOwner,
} from '../persist';

const mockGetSession = jest.fn();
jest.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ auth: { getSession: () => mockGetSession() } }),
}));

const kv = jest.requireMock('expo-sqlite/kv-store').default as {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

const testClient = () =>
  new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });

const signedInAs = (id: string | null) =>
  mockGetSession.mockResolvedValue({ data: { session: id ? { user: { id } } : null } });

const stored = async () => JSON.parse((await kv.getItem(PERSIST_KEY)) ?? 'null');

/** The persister throttles writes to one per second. */
const afterThrottle = () => new Promise((r) => setTimeout(r, 1100));

beforeEach(async () => {
  setPersistOwner('u1');
  await clearPersistedCache();
});
afterEach(() => onlineManager.setOnline(true));

describe('persisted query allowlist', () => {
  it('writes only successful curriculum and progress queries', async () => {
    const client = testClient();
    client.setQueryData(learningKeys.courses(), []);
    client.setQueryData(learningKeys.course('c1'), { id: 'c1' });
    client.setQueryData(learningKeys.lesson('l1'), { id: 'l1' });
    client.setQueryData(learningKeys.progress(), []);
    client.setQueryData(learningKeys.search('qubit'), []);
    client.setQueryData(profileKeys.me('u1'), { email: 'a@b.co' });
    client.setQueryData(['tutor', 'session', 's1'], { messages: [] });
    await client
      .prefetchQuery({ queryKey: learningKeys.lesson('broken'), queryFn: () => Promise.reject(new Error('x')) })
      .catch(() => undefined);

    const state = dehydrate(client, persistOptions.dehydrateOptions);

    expect(state.queries.map((q) => q.queryKey)).toEqual([
      learningKeys.courses(),
      learningKeys.course('c1'),
      learningKeys.lesson('l1'),
      learningKeys.progress(),
    ]);
  });

  it('writes paused lesson completions and no other mutation', async () => {
    const client = testClient();
    onlineManager.setOnline(false);
    void client
      .getMutationCache()
      .build(client, { mutationKey: LESSON_COMPLETE_MUTATION_KEY, mutationFn: async () => 'ok' })
      .execute('l1')
      .catch(() => undefined);
    void client
      .getMutationCache()
      .build(client, { mutationKey: ['tutor', 'send'], mutationFn: async () => 'ok' })
      .execute('hi')
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));

    const state = dehydrate(client, persistOptions.dehydrateOptions);

    expect(state.mutations).toHaveLength(1);
    expect(state.mutations[0]).toMatchObject({
      mutationKey: LESSON_COMPLETE_MUTATION_KEY,
      state: { isPaused: true, variables: 'l1' },
    });
    client.clear();
  });
});

describe('persister', () => {
  const save = (client: QueryClient) => persistQueryClientSave({ queryClient: client, ...persistOptions });
  const withProgress = () => {
    const client = testClient();
    client.setQueryData(learningKeys.progress(), []);
    return client;
  };

  it('saves under its key, stamped with the owner, and clearPersistedCache removes it', async () => {
    await save(withProgress());
    expect(await stored()).toMatchObject({
      ownerId: 'u1',
      buster: persistOptions.buster,
      clientState: { queries: [{ queryKey: learningKeys.progress() }] },
    });

    await clearPersistedCache();
    expect(await kv.getItem(PERSIST_KEY)).toBeNull();
  });

  it('removes the key instead of writing an empty cache', async () => {
    await kv.setItem(PERSIST_KEY, '{"stale":true}');
    await afterThrottle();
    await save(testClient());
    expect(await kv.getItem(PERSIST_KEY)).toBeNull();
  });

  it('saves nothing while signed out', async () => {
    setPersistOwner(null);
    await kv.setItem(PERSIST_KEY, '{"stale":true}');
    await afterThrottle();
    await save(withProgress());
    expect(await kv.getItem(PERSIST_KEY)).toBeNull();
  });

  it('leaves no key when signing out while a save is still throttled', async () => {
    await afterThrottle();
    const client = withProgress();
    const unsubscribe = persistQueryClientSubscribe({ queryClient: client, ...persistOptions });
    client.setQueryData(learningKeys.lesson('l1'), { id: 'l1' }); // written at once
    client.setQueryData(learningKeys.lesson('l2'), { id: 'l2' }); // waits in the throttle
    await new Promise((r) => setTimeout(r, 50));
    expect(await stored()).not.toBeNull();

    // AuthProvider's sign-out wipe.
    setPersistOwner(null);
    client.clear();
    await clearPersistedCache();
    await afterThrottle();

    expect(await kv.getItem(PERSIST_KEY)).toBeNull();
    unsubscribe();
  });

  describe('restore', () => {
    const restore = async () => {
      const client = testClient();
      await persistQueryClientRestore({ queryClient: client, ...persistOptions });
      return client;
    };

    beforeEach(async () => {
      await afterThrottle();
      await save(withProgress());
      expect(await stored()).not.toBeNull();
    });

    it("hydrates the signed-in owner's cache", async () => {
      signedInAs('u1');
      const client = await restore();
      expect(client.getQueryData(learningKeys.progress())).toEqual([]);
      expect(await stored()).not.toBeNull();
    });

    it('discards the cache when nobody is signed in', async () => {
      signedInAs(null);
      const client = await restore();
      expect(client.getQueryData(learningKeys.progress())).toBeUndefined();
      expect(await kv.getItem(PERSIST_KEY)).toBeNull();
    });

    it('discards the cache when another account is signed in', async () => {
      signedInAs('u2');
      const client = await restore();
      expect(client.getQueryData(learningKeys.progress())).toBeUndefined();
      expect(await kv.getItem(PERSIST_KEY)).toBeNull();
    });

    it('discards the cache when the session cannot be read', async () => {
      mockGetSession.mockRejectedValue(new Error('keychain locked'));
      const client = await restore();
      expect(client.getQueryData(learningKeys.progress())).toBeUndefined();
      expect(await kv.getItem(PERSIST_KEY)).toBeNull();
    });
  });
});
