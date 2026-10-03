import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ApiError } from '@/lib/api/errors';
import type { ProgressItem } from '@/types/contracts';

import { learningKeys, useMarkLessonComplete } from '../hooks';

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
});
