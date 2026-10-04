import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import LessonScreen from '@/app/lesson/[id]';
import { learningKeys } from '@/features/learning/hooks';
import { createQueryClient } from '@/lib/query/client';
import type { LessonDetail, ProgressItem } from '@/types/contracts';

const LESSON = '0b6f1f6e-1111-4c1e-9f00-000000000001';

const mockUpdate = jest.fn();
/** What the server has saved; the progress refetch after a completion reads it. */
let mockServerRows: ProgressItem[] = [];
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), navigate: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: '0b6f1f6e-1111-4c1e-9f00-000000000001' }),
}));
jest.mock('@/lib/api/endpoints/learning', () => ({
  listCourses: jest.fn(async () => []),
  getCourse: jest.fn(),
  getLesson: jest.fn(() => new Promise(() => undefined)),
  getProgress: jest.fn(async () => mockServerRows),
  updateLessonProgress: (...args: unknown[]) => mockUpdate(...args),
}));

const lesson: LessonDetail = {
  id: LESSON,
  module_id: 'm1',
  title: 'What is a qubit?',
  content: null,
  lesson_type: 'text',
  is_pro: false,
  concepts: [],
};

function client(): QueryClient {
  const queryClient = createQueryClient();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
  return queryClient;
}

async function renderScreen(queryClient: QueryClient) {
  await render(
    <QueryClientProvider client={queryClient}>
      <LessonScreen />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockUpdate.mockReset();
  mockServerRows = [];
});
afterEach(() => onlineManager.setOnline(true));

describe('LessonScreen offline', () => {
  it('shows the offline error, not a spinner, for a lesson that was never cached', async () => {
    onlineManager.setOnline(false);
    await renderScreen(client());
    expect(screen.queryByLabelText('Loading lesson…')).toBeNull();
    expect(screen.getByText(/You're offline or the server can't be reached/)).toBeTruthy();
  });

  it('shows an offline completion as pending sync until the server saves it', async () => {
    const saved: ProgressItem = { lesson_id: LESSON, status: 'completed', completion_pct: 100 };
    mockUpdate.mockImplementation(async () => {
      mockServerRows = [saved];
      return saved;
    });
    const queryClient = client();
    queryClient.setQueryData(learningKeys.lesson(LESSON), lesson);
    queryClient.setQueryData(learningKeys.progress(), []);
    await renderScreen(queryClient);

    await act(async () => onlineManager.setOnline(false));
    await fireEvent.press(screen.getByRole('button', { name: 'Mark complete' }));

    expect(await screen.findByText("Saved on this device · syncs when you're back online")).toBeTruthy();
    expect(screen.queryByText('Completed')).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();

    await act(async () => onlineManager.setOnline(true));

    expect(await screen.findByText('Completed')).toBeTruthy();
    expect(screen.queryByText(/Saved on this device/)).toBeNull();
    expect(mockUpdate).toHaveBeenCalledWith(LESSON, { status: 'completed', completion_pct: 100 });
  });
});
