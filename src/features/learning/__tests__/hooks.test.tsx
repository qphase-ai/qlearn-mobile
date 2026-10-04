import { dehydrate, hydrate, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ApiError } from '@/lib/api/errors';
import { createQueryClient } from '@/lib/query/client';
import { persistOptions } from '@/lib/query/persist';
import type { ProgressItem } from '@/types/contracts';

import {
  learningKeys,
  useLessonCompletionPendingSync,
  useMarkLessonComplete,
  usePendingLessonCompletions,
} from '../hooks';

const mockUpdate = jest.fn();
jest.mock('@/lib/api/endpoints/learning', () => ({
  updateLessonProgress: (...args: unknown[]) => mockUpdate(...args),
}));

function setup(initial: ProgressItem[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { retry: false } } });
  queryClient.setQueryData(learningKeys.progress(), initial);
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const LESSON = '0b6f1f6e-1111-4c1e-9f00-000000000001';

beforeEach(() => mockUpdate.mockReset());
afterEach(() => onlineManager.setOnline(true));

/** The app's client (mutation defaults included), minus gc timers. */
function appClient(initial: ProgressItem[]) {
  const queryClient = createQueryClient();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
  queryClient.setQueryData(learningKeys.progress(), initial);
  return queryClient;
}

describe('useMarkLessonComplete', () => {
  it('updates progress optimistically and keeps the server row', async () => {
    let resolve!: (row: ProgressItem) => void;
    mockUpdate.mockReturnValue(new Promise((r) => (resolve = r)));
    const { queryClient, wrapper } = setup([{ lesson_id: 'other', status: 'completed', completion_pct: 100 }]);
    const { result } = await renderHook(() => useMarkLessonComplete(), { wrapper });

    await act(async () => {
      result.current.mutate(LESSON);
    });
    await waitFor(() =>
      expect(queryClient.getQueryData<ProgressItem[]>(learningKeys.progress())).toContainEqual({
        lesson_id: LESSON,
        status: 'completed',
        completion_pct: 100,
      })
    );
    expect(mockUpdate).toHaveBeenCalledWith(LESSON, { status: 'completed', completion_pct: 100 });

    await act(async () => resolve({ lesson_id: LESSON, status: 'completed', completion_pct: 100 }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData<ProgressItem[]>(learningKeys.progress())).toHaveLength(2);
  });

  it('rolls back when the backend rejects the update', async () => {
    mockUpdate.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }));
    const initial = [{ lesson_id: 'other', status: 'completed', completion_pct: 100 }];
    const { queryClient, wrapper } = setup(initial);
    const { result } = await renderHook(() => useMarkLessonComplete(), { wrapper });

    await act(async () => {
      result.current.mutate(LESSON);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(learningKeys.progress())).toEqual(initial);
  });

  it('refuses lessons that cannot record progress', async () => {
    const { wrapper } = setup([]);
    const { result } = await renderHook(() => useMarkLessonComplete(), { wrapper });
    await act(async () => {
      result.current.mutate('payload:42');
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('pauses offline, stays optimistic and pending sync, then sends once back online', async () => {
    const saved = { lesson_id: LESSON, status: 'completed', completion_pct: 100 };
    mockUpdate.mockResolvedValue(saved);
    const queryClient = appClient([]);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(
      () => ({ mutation: useMarkLessonComplete(), pendingSync: useLessonCompletionPendingSync(LESSON) }),
      { wrapper }
    );

    await act(async () => onlineManager.setOnline(false));
    await act(async () => {
      result.current.mutation.mutate(LESSON);
    });

    await waitFor(() => expect(result.current.mutation.isPaused).toBe(true));
    expect(result.current.pendingSync).toBe(true);
    expect(result.current.mutation.isError).toBe(false);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(learningKeys.progress())).toEqual([saved]);

    await act(async () => onlineManager.setOnline(true));

    await waitFor(() => expect(result.current.mutation.isSuccess).toBe(true));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.pendingSync).toBe(false);
    expect(queryClient.getQueryData(learningKeys.progress())).toEqual([saved]);
  });

  it('runs a completion restored after a restart through the mutation defaults', async () => {
    mockUpdate.mockResolvedValue({ lesson_id: LESSON, status: 'completed', completion_pct: 100 });
    const before = appClient([]);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={before}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useMarkLessonComplete(), { wrapper });
    await act(async () => onlineManager.setOnline(false));
    await act(async () => {
      result.current.mutate(LESSON);
    });
    await waitFor(() => expect(result.current.isPaused).toBe(true));
    const persisted = JSON.parse(JSON.stringify(dehydrate(before, persistOptions.dehydrateOptions)));
    before.clear();

    // A fresh process: only the key and variables come back, not the function.
    const after = appClient([]);
    hydrate(after, persisted);
    expect(after.getMutationCache().getAll()).toHaveLength(1);
    await act(async () => onlineManager.setOnline(true));
    await act(async () => {
      await after.resumePausedMutations();
    });

    expect(mockUpdate).toHaveBeenCalledWith(LESSON, { status: 'completed', completion_pct: 100 });
    expect(after.getMutationCache().getAll()[0].state.status).toBe('success');
  });

  it('rolls back only its own row when the server rejects a queued completion', async () => {
    const OTHER = '0b6f1f6e-1111-4c1e-9f00-000000000002';
    const queryClient = appClient([]);
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(
      () => ({ first: useMarkLessonComplete(), second: useMarkLessonComplete(), pending: usePendingLessonCompletions() }),
      { wrapper }
    );

    await act(async () => onlineManager.setOnline(false));
    await act(async () => {
      result.current.first.mutate(LESSON);
      result.current.second.mutate(OTHER);
    });
    await waitFor(() => expect([...result.current.pending].sort()).toEqual([LESSON, OTHER].sort()));

    // Back online: LESSON is rejected, OTHER stays queued behind a slow request.
    mockUpdate.mockImplementation((id: string) =>
      id === LESSON
        ? Promise.reject(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'no' }))
        : new Promise(() => undefined)
    );
    await act(async () => onlineManager.setOnline(true));

    await waitFor(() => expect(result.current.first.isError).toBe(true));
    expect(queryClient.getQueryData<ProgressItem[]>(learningKeys.progress())).toEqual([
      { lesson_id: OTHER, status: 'completed', completion_pct: 100 },
    ]);
    expect(result.current.pending.size).toBe(0);
  });
});
