/** Query keys for curriculum and progress. lib/query/persist.ts allowlists some of these roots. */
export const learningKeys = {
  all: ['learning'] as const,
  courses: () => [...learningKeys.all, 'courses'] as const,
  course: (id: string) => [...learningKeys.all, 'course', id] as const,
  lesson: (id: string) => [...learningKeys.all, 'lesson', id] as const,
  progress: () => [...learningKeys.all, 'progress'] as const,
  search: (q: string) => [...learningKeys.all, 'search', q] as const,
};
