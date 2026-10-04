import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import LearnScreen from '@/app/(tabs)/learn';
import { createQueryClient } from '@/lib/query/client';
import { LESSON_COMPLETE_MUTATION_KEY } from '@/lib/query/persist';
import type { CourseDetail, LessonSearchResult } from '@/types/contracts';

const COURSE = '0b6f1f6e-1111-4c1e-9f00-0000000000c1';
const id = (n: number) => `0b6f1f6e-1111-4c1e-9f00-${String(n).padStart(12, '0')}`;

const mockCourse: CourseDetail = {
  id: COURSE,
  title: 'Quantum basics',
  description: null,
  difficulty: 'beginner',
  modules: [
    {
      id: id(101),
      title: 'Qubits',
      order_index: 0,
      lessons: [{ id: id(1), title: 'What is a qubit?', lesson_type: 'text', is_pro: false, order_index: 0 }],
    },
    {
      id: id(102),
      title: 'Gates',
      order_index: 1,
      lessons: [{ id: id(2), title: 'Hadamard gate', lesson_type: 'text', is_pro: false, order_index: 0 }],
    },
  ],
};

const hit = (lessonId: string, title: string): LessonSearchResult => ({
  lesson_id: lessonId,
  lesson_title: title,
  lesson_type: 'text',
  is_pro: false,
  module_id: id(102),
  module_title: 'Gates',
  course_id: COURSE,
  course_title: 'Quantum basics',
  snippet: null,
});

const mockSearch = jest.fn();
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/lib/api/endpoints/learning', () => ({
  listCourses: jest.fn(async () => [{ id: COURSE, title: 'Quantum basics', description: null, difficulty: 'beginner' }]),
  getCourse: jest.fn(async () => mockCourse),
  getProgress: jest.fn(async () => []),
  searchLessons: (...args: unknown[]) => mockSearch(...args),
  updateLessonProgress: jest.fn(async () => new Promise(() => undefined)),
}));

function client(): QueryClient {
  const queryClient = createQueryClient();
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity, retry: false },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
  return queryClient;
}

async function renderScreen(queryClient = client()) {
  await render(
    <QueryClientProvider client={queryClient}>
      <LearnScreen />
    </QueryClientProvider>
  );
  await screen.findByText('Qubits');
  return queryClient;
}

beforeEach(() => {
  mockSearch.mockReset();
  mockSearch.mockImplementation(async () => [hit(id(2), 'Hadamard gate')]);
});
afterEach(() => onlineManager.setOnline(true));

describe('LearnScreen search', () => {
  it('keeps the same search field while the list switches to hits and back to levels', async () => {
    await renderScreen();
    // Focus is native and invisible to the test renderer; a remounted header would
    // drop it, so the proxy is that the same TextInput instance survives.
    const field = screen.getByLabelText('Search lessons');

    await fireEvent.changeText(field, 'hadamard');
    expect(await screen.findByRole('button', { name: 'Hadamard gate' })).toBeTruthy();
    expect(mockSearch).toHaveBeenCalledWith('hadamard', expect.anything());
    expect(screen.queryByText('Qubits')).toBeNull();
    // The header is not remounted: the very same TextInput instance, still holding the text.
    expect(screen.getByLabelText('Search lessons')).toBe(field);
    expect(field.props.value).toBe('hadamard');

    await fireEvent.changeText(field, '');
    expect(await screen.findByText('Qubits')).toBeTruthy();
    expect(screen.getByText('Gates')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hadamard gate' })).toBeNull();
    expect(screen.getByLabelText('Search lessons')).toBe(field);
  });

  it('marks a search hit whose completion is queued offline as waiting to sync', async () => {
    const queryClient = await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Search lessons'), 'hadamard');
    expect(await screen.findByRole('button', { name: 'Hadamard gate' })).toBeTruthy();

    // Queue a completion offline through the app's own mutation defaults, as the lesson screen does.
    await act(async () => onlineManager.setOnline(false));
    await act(async () => {
      void queryClient
        .getMutationCache()
        .build(queryClient, { mutationKey: LESSON_COMPLETE_MUTATION_KEY })
        .execute(id(2))
        .catch(() => undefined);
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hadamard gate, completed, waiting to sync' })).toBeTruthy()
    );
    expect(screen.getByText('Waiting to sync')).toBeTruthy();
  });
});
