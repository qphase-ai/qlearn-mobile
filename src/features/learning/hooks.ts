import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getEnv } from '@/lib/env';
import {
  getCourse,
  getLesson,
  getProgress,
  listCourses,
  searchLessons,
} from '@/lib/api/endpoints/learning';
import { LESSON_COMPLETE_MUTATION_KEY } from '@/lib/query/persist';
import { usePreferencesStore } from '@/stores/preferences-store';
import type { CourseDetail, ProgressItem } from '@/types/contracts';

import { completeLesson } from './api';
import { progressMap, searchCourseTitles } from './curriculum';
import { learningKeys } from './keys';

export { learningKeys };

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
 * Mark a lesson complete. Optimistic: the progress cache updates at once.
 * Offline the mutation pauses (not an error), keeps the optimistic row and is
 * persisted until it can be sent; the UI shows it as pending sync, never as
 * saved. It rolls back only if the backend rejects it, or the request fails
 * while we believed we were online.
 */
export function useMarkLessonComplete() {
  const queryClient = useQueryClient();
  return useMutation<ProgressItem, Error, string, { previous: ProgressItem[] | undefined }>({
    mutationKey: LESSON_COMPLETE_MUTATION_KEY,
    mutationFn: completeLesson,
    onMutate: async (lessonId) => {
      await queryClient.cancelQueries({ queryKey: learningKeys.progress() });
      const previous = queryClient.getQueryData<ProgressItem[]>(learningKeys.progress());
      queryClient.setQueryData<ProgressItem[]>(learningKeys.progress(), (rows = []) => [
        ...rows.filter((r) => r.lesson_id !== lessonId),
        { lesson_id: lessonId, status: 'completed', completion_pct: 100 },
      ]);
      return { previous };
    },
    onError: (_err, lessonId, context) => {
      // Undo only this lesson's row: other completions may be queued meanwhile.
      const before = context?.previous?.find((r) => r.lesson_id === lessonId);
      queryClient.setQueryData<ProgressItem[]>(learningKeys.progress(), (rows) =>
        rows ? [...rows.filter((r) => r.lesson_id !== lessonId), ...(before ? [before] : [])] : rows
      );
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<ProgressItem[]>(learningKeys.progress(), (rows = []) => [
        ...rows.filter((r) => r.lesson_id !== saved.lesson_id),
        saved,
      ]);
    },
  });
}

/**
 * Lessons whose completion is queued offline. The progress cache already
 * counts them (optimistic), so screens mark them as waiting to sync rather
 * than saved. Reads the mutation cache, so it also covers completions
 * restored after a restart.
 */
export function usePendingLessonCompletions(): ReadonlySet<string> {
  const ids = useMutationState({
    filters: {
      mutationKey: LESSON_COMPLETE_MUTATION_KEY,
      status: 'pending',
      predicate: (m) => m.state.isPaused,
    },
    select: (m) => m.state.variables as string,
  });
  // `ids` keeps its identity while unchanged (useMutationState shares structure).
  return useMemo(() => new Set(ids), [ids]);
}

/** True while a completion of this lesson is queued offline. */
export function useLessonCompletionPendingSync(lessonId: string | undefined): boolean {
  const pending = usePendingLessonCompletions();
  return !!lessonId && pending.has(lessonId);
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
