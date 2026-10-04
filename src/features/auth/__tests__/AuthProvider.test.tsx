import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

type AuthListener = (event: string, session: unknown) => void;

const mockAuth = {
  listener: null as AuthListener | null,
  getSession: jest.fn(),
  signOut: jest.fn(async () => ({ error: null })),
  onAuthStateChange: jest.fn((cb: AuthListener) => {
    mockAuth.listener = cb;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
};

jest.mock('@/lib/supabase/client', () => ({
  getSupabase: () => ({ auth: mockAuth }),
  getAccessToken: jest.fn(async () => null),
}));

// eslint-disable-next-line import/first
import { PENDING_HREF_KEY } from '@/features/linking/pending-href';

// eslint-disable-next-line import/first
import { REMINDER_ID } from '@/features/notifications/reminders';

// eslint-disable-next-line import/first
import { apiClient } from '@/lib/api/client';

// eslint-disable-next-line import/first
import { LESSON_COMPLETE_MUTATION_KEY, PERSIST_KEY } from '@/lib/query/persist';

// eslint-disable-next-line import/first
import { DEFAULT_REMINDER, usePreferencesStore } from '@/stores/preferences-store';

// eslint-disable-next-line import/first
import { AuthProvider, useAuth } from '../AuthProvider';

function Probe() {
  const { session, isLoading } = useAuth();
  return <Text>{isLoading ? 'loading' : session ? 'signed-in' : 'signed-out'}</Text>;
}

async function renderProvider(queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })) {
  await render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>
  );
  return queryClient;
}

const session = { access_token: 't', user: { id: 'u1', email: 'a@b.co' } };

beforeEach(() => jest.clearAllMocks());

describe('AuthProvider', () => {
  it('restores a persisted session', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session } });
    await renderProvider();
    expect(await screen.findByText('signed-in')).toBeTruthy();
  });

  it('starts signed out when there is no session', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await renderProvider();
    expect(await screen.findByText('signed-out')).toBeTruthy();
  });

  it('starts signed out when secure storage is unreadable', async () => {
    mockAuth.getSession.mockRejectedValue(new Error('keychain locked'));
    await renderProvider();
    expect(await screen.findByText('signed-out')).toBeTruthy();
  });

  it('clears cached server data on sign-out', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    queryClient.setQueryData(['profile', 'me', 'u1'], { email: 'a@b.co' });
    await renderProvider(queryClient);
    await screen.findByText('signed-in');

    await act(async () => mockAuth.listener?.('SIGNED_OUT', null));

    expect(screen.getByText('signed-out')).toBeTruthy();
    expect(queryClient.getQueryData(['profile', 'me', 'u1'])).toBeUndefined();
  });

  it('wipes queued completions and the offline cache on sign-out', async () => {
    const kv = jest.requireMock('expo-sqlite/kv-store').default;
    await kv.setItem(PERSIST_KEY, '{"clientState":{}}');
    mockAuth.getSession.mockResolvedValue({ data: { session } });
    const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
    queryClient.getMutationCache().build(queryClient, { mutationKey: LESSON_COMPLETE_MUTATION_KEY, gcTime: Infinity });
    await renderProvider(queryClient);
    await screen.findByText('signed-in');

    await act(async () => mockAuth.listener?.('SIGNED_OUT', null));

    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    await waitFor(async () => expect(await kv.getItem(PERSIST_KEY)).toBeNull());
  });

  it('keeps a pending deep link through a signed-out launch, forgets it on sign-out', async () => {
    const kv = jest.requireMock('expo-sqlite/kv-store').default;
    const entry = JSON.stringify({ href: '/learn', savedAt: Date.now() });
    await kv.setItem(PENDING_HREF_KEY, entry);
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await renderProvider();
    await screen.findByText('signed-out');

    // auth-js emits SIGNED_OUT before INITIAL_SESSION when a stored refresh token fails.
    await act(async () => mockAuth.listener?.('SIGNED_OUT', null));
    await act(async () => mockAuth.listener?.('INITIAL_SESSION', null));
    expect(await kv.getItem(PENDING_HREF_KEY)).toBe(entry);

    await act(async () => mockAuth.listener?.('SIGNED_IN', session));
    await act(async () => mockAuth.listener?.('SIGNED_OUT', null));
    await waitFor(async () => expect(await kv.getItem(PENDING_HREF_KEY)).toBeNull());
  });

  it('cancels the study reminder and resets it on sign-out', async () => {
    const notifications = jest.requireMock('expo-notifications');
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 7, minute: 30 } });
    mockAuth.getSession.mockResolvedValue({ data: { session } });
    await renderProvider();
    await screen.findByText('signed-in');
    await act(async () => mockAuth.listener?.('INITIAL_SESSION', session));
    expect(usePreferencesStore.getState().reminder.enabled).toBe(true);

    await act(async () => mockAuth.listener?.('SIGNED_OUT', null));

    await waitFor(() => expect(usePreferencesStore.getState().reminder).toEqual(DEFAULT_REMINDER));
    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
  });

  it.each([
    ['INITIAL_SESSION with no session', ['INITIAL_SESSION']],
    ['SIGNED_OUT at launch (dead refresh token)', ['SIGNED_OUT', 'INITIAL_SESSION']],
  ])('resets the study reminder on a signed-out launch: %s', async (_case, events) => {
    const notifications = jest.requireMock('expo-notifications');
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 7, minute: 30 } });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await renderProvider();
    await screen.findByText('signed-out');

    for (const event of events) await act(async () => mockAuth.listener?.(event, null));

    expect(notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
    await waitFor(() => expect(usePreferencesStore.getState().reminder).toEqual(DEFAULT_REMINDER));
  });

  describe('per-account cache', () => {
    const kv = jest.requireMock('expo-sqlite/kv-store').default;
    const userB = { access_token: 't2', user: { id: 'u2', email: 'b@b.co' } };

    async function signedInWithCache() {
      await kv.setItem(PERSIST_KEY, '{"ownerId":"u1"}');
      mockAuth.getSession.mockResolvedValue({ data: { session } });
      const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
      queryClient.setQueryData(['learning', 'progress'], [{ lesson_id: 'l1' }]);
      await renderProvider(queryClient);
      await screen.findByText('signed-in');
      return queryClient;
    }

    it('wipes a cache left from before when the app starts signed out', async () => {
      const queryClient = await signedInWithCache();
      await act(async () => mockAuth.listener?.('INITIAL_SESSION', null));
      expect(queryClient.getQueryData(['learning', 'progress'])).toBeUndefined();
      await waitFor(async () => expect(await kv.getItem(PERSIST_KEY)).toBeNull());
    });

    it('keeps the cache when the same account signs in again', async () => {
      const queryClient = await signedInWithCache();
      await act(async () => mockAuth.listener?.('INITIAL_SESSION', session));
      await act(async () => mockAuth.listener?.('SIGNED_IN', session));
      expect(queryClient.getQueryData(['learning', 'progress'])).toEqual([{ lesson_id: 'l1' }]);
      expect(await kv.getItem(PERSIST_KEY)).not.toBeNull();
    });

    it('wipes the cache when a different account signs in', async () => {
      const queryClient = await signedInWithCache();
      await act(async () => mockAuth.listener?.('INITIAL_SESSION', session));
      await act(async () => mockAuth.listener?.('SIGNED_IN', userB));
      expect(queryClient.getQueryData(['learning', 'progress'])).toBeUndefined();
      await waitFor(async () => expect(await kv.getItem(PERSIST_KEY)).toBeNull());
    });
  });

  it('signs out when the API reports a dead session', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session } });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Not authenticated' }),
    } as Response);
    await renderProvider();
    await screen.findByText('signed-in');

    await act(async () => {
      await apiClient.request('/api/v1/auth/me').catch(() => undefined);
    });

    expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    fetchSpy.mockRestore();
  });
});
