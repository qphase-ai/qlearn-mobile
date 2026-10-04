import { render, screen } from '@testing-library/react-native';

import LevelScreen from '@/app/level/[id]';
import type { CourseDetail } from '@/types/contracts';

const COURSE = '0b6f1f6e-1111-4c1e-9f00-0000000000c1';
const LEVEL = '0b6f1f6e-1111-4c1e-9f00-0000000000a1';
const lessonId = (n: number) => `0b6f1f6e-1111-4c1e-9f00-${String(n).padStart(12, '0')}`;

const mockCourse: CourseDetail = {
  id: COURSE,
  title: 'Quantum basics',
  description: null,
  difficulty: 'beginner',
  modules: [
    {
      id: LEVEL,
      title: 'Superposition',
      order_index: 0,
      lessons: Array.from({ length: 3 }, (_, i) => ({
        id: lessonId(i + 1),
        title: `Lesson ${i + 1}`,
        lesson_type: 'text' as const,
        is_pro: false,
        order_index: i,
      })),
    },
  ],
};
let mockProgress: Record<string, number> = {};

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: LEVEL, courseId: COURSE }),
}));
jest.mock('@/features/learning/hooks', () => ({
  useActiveCourse: () => ({ activeId: COURSE }),
  useCourse: () => ({ isPending: false, isError: false, data: mockCourse }),
  useProgress: () => ({ progress: mockProgress }),
  usePendingLessonCompletions: () => new Set<string>(),
}));

describe('LevelScreen list', () => {
  beforeEach(() => {
    mockProgress = {};
  });

  it('renders the level summary as the list header and every lesson as a row', async () => {
    await render(<LevelScreen />);
    expect(screen.getByText('Superposition')).toBeTruthy();
    expect(screen.getByText('0 of 3 lessons complete')).toBeTruthy();
    for (const n of [1, 2, 3]) {
      expect(screen.getByRole('button', { name: `Lesson 1.${n}, Lesson ${n}` })).toBeTruthy();
    }
  });

  it('shows new progress on a row after the progress query updates', async () => {
    const view = await render(<LevelScreen />);
    mockProgress = { [lessonId(2)]: 100 };
    await view.rerender(<LevelScreen />);
    expect(screen.getByRole('button', { name: 'Lesson 1.2, Lesson 2, completed' })).toBeTruthy();
  });
});
