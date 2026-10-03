import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getEnv } from '@/lib/env';
import {
  getCourse,
  getLesson,
  getProgress,
  listCourses,
  searchLessons,
  updateLessonProgress,
} from '@/lib/api/endpoints/learning';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { CourseDetail, ProgressItem } from '@/types/contracts';

import { isTrackableLessonId, progressMap, searchCourseTitles } from './curriculum';

export const learningKeys = {
  all: ['learning'] as const,
  courses: () => [...learningKeys.all, 'courses'] as const,
  course: (id: string) => [...learningKeys.all, 'course', id] as const,
  lesson: (id: string) => [...learningKeys.all, 'lesson', id] as const,
  progress: () => [...learningKeys.all, 'progress'] as const,
  search: (q: string) => [...learningKeys.all, 'search', q] as const,
};

// Authored content changes rarely (CMS publishes revalidate the web cache).
const CONTENT_STALE_MS = 5 * 60_000;

export function useCourses() {
  return useQuery({
    queryKey: learningKeys.courses(),
    queryFn: ({ signal }) => listCourses(signal),
    staleTime: CONTENT_STALE_MS,
  });
}

export function useCourse(courseId: string | null | undefined) {
  return useQuery({
    queryKey: learningKeys.course(courseId ?? ''),
    queryFn: ({ signal }) => getCourse(courseId as string, signal),
    enabled: !!courseId,
    staleTime: CONTENT_STALE_MS,
  });
}

export function useLesson(lessonId: string | null | undefined) {
  return useQuery({
    queryKey: learningKeys.lesson(lessonId ?? ''),
    queryFn: ({ signal }) => getLesson(lessonId as string, signal),
    enabled: !!lessonId,
    staleTime: CONTENT_STALE_MS,
  });
}

/** The student's progress as a lessonId → percent map. */
export function useProgress() {
  const query = useQuery({
    queryKey: learningKeys.progress(),
    queryFn: ({ signal }) => getProgress(signal),
  });
  const map = useMemo(() => progressMap(query.data), [query.data]);
  return { ...query, progress: map };
}

/**
 * The course the student is following: their saved choice if it still
 * exists, otherwise the first published course (web behaviour).
 */
export function useActiveCourse() {
  const courses = useCourses();
  const selectedCourseId = usePreferencesStore((s) => s.selectedCourseId);
  const activeId =
    courses.data?.find((c) => c.id === selectedCourseId)?.id ?? courses.data?.[0]?.id ?? null;
  const course = useCourse(activeId);
  return { courses, course, activeId };
}

/**
 * Mark a lesson complete. Optimistic: the progress cache updates at once,
 * then rolls back if the backend rejects it (offline included). Nothing is
 * reported as saved until the server confirms.
 */
export function useMarkLessonComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      if (!isTrackableLessonId(lessonId)) {
        throw new Error('Progress tracking is unavailable for this lesson.');
      }
      return updateLessonProgress(lessonId, { status: 'completed', completion_pct: 100 });
    },
    onMutate: async (lessonId) => {
      await queryClient.cancelQueries({ queryKey: learningKeys.progress() });
      const previous = queryClient.getQueryData<ProgressItem[]>(learningKeys.progress());
      queryClient.setQueryData<ProgressItem[]>(learningKeys.progress(), (rows = []) => [
        ...rows.filter((r) => r.lesson_id !== lessonId),
        { lesson_id: lessonId, status: 'completed', completion_pct: 100 },
      ]);
      return { previous };
    },
    onError: (_err, _lessonId, context) => {
      queryClient.setQueryData(learningKeys.progress(), context?.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<ProgressItem[]>(learningKeys.progress(), (rows = []) => [
        ...rows.filter((r) => r.lesson_id !== saved.lesson_id),
        saved,
      ]);
    },
  });
}

export const MIN_SEARCH_LENGTH = 2;

/**
 * Lesson search. Legacy content uses the backend search endpoint; the CMS
 * source has no search route yet, so it matches titles in the loaded course,
 * exactly like the web.
 */
export function useLessonSearch(query: string, course: CourseDetail | undefined) {
  const q = query.trim();
  const isCms = getEnv().contentSource === 'cms';
  const remote = useQuery({
    queryKey: learningKeys.search(q),
    queryFn: ({ signal }) => searchLessons(q, signal),
    enabled: !isCms && q.length >= MIN_SEARCH_LENGTH,
    staleTime: 60_000,
  });
  const local = useMemo(
    () => (isCms && course && q.length >= MIN_SEARCH_LENGTH ? searchCourseTitles(course, q) : undefined),
    [isCms, course, q]
  );
  return isCms
    ? { data: local, isPending: false, isError: false, error: null, refetch: () => undefined }
    : remote;
}
