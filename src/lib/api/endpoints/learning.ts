import { getEnv } from '@/lib/env';
import type {
  CourseDetail,
  CourseSummary,
  LessonDetail,
  LessonSearchResult,
  ProgressItem,
  UpdateProgressRequest,
} from '@/types/contracts';

import { apiClient, createApiClient } from '../client';

/**
 * Curriculum content comes from the same source as the web
 * (`EXPO_PUBLIC_CONTENT_SOURCE`, mirroring `NEXT_PUBLIC_CONTENT_SOURCE`):
 *   legacy → FastAPI `/api/v1/courses|lessons` (authenticated)
 *   cms    → the web app's `/api/cms/*`, which maps Payload documents onto the
 *            same CourseDetail/LessonDetail contract (anonymous, published only)
 * Learner state (progress, search) always comes from FastAPI.
 */

const contentClient = createApiClient({
  baseUrl: () => {
    const { contentUrl } = getEnv();
    if (!contentUrl) throw new Error('EXPO_PUBLIC_CONTENT_URL is required for the cms source');
    return contentUrl;
  },
  getAccessToken: async () => null,
  refreshAccessToken: async () => null,
});

const isCms = () => getEnv().contentSource === 'cms';

export function listCourses(signal?: AbortSignal): Promise<CourseSummary[]> {
  return isCms()
    ? contentClient.request('/api/cms/courses', { auth: false, signal })
    : apiClient.request('/api/v1/courses', { signal });
}

export function getCourse(courseId: string, signal?: AbortSignal): Promise<CourseDetail> {
  const id = encodeURIComponent(courseId);
  return isCms()
    ? contentClient.request(`/api/cms/courses/${id}`, { auth: false, signal })
    : apiClient.request(`/api/v1/courses/${id}`, { signal });
}

export function getLesson(lessonId: string, signal?: AbortSignal): Promise<LessonDetail> {
  const id = encodeURIComponent(lessonId);
  return isCms()
    ? contentClient.request(`/api/cms/lessons/${id}`, { auth: false, signal })
    : apiClient.request(`/api/v1/lessons/${id}`, { signal });
}

/** All progress rows for the signed-in student. */
export function getProgress(signal?: AbortSignal): Promise<ProgressItem[]> {
  return apiClient.request('/api/v1/progress', { signal });
}

export function updateLessonProgress(
  lessonId: string,
  body: UpdateProgressRequest
): Promise<ProgressItem> {
  return apiClient.request(`/api/v1/lessons/${encodeURIComponent(lessonId)}/progress`, {
    method: 'PUT',
    body,
  });
}

/** Lesson search over legacy content (`GET /api/v1/search/lessons`). */
export function searchLessons(query: string, signal?: AbortSignal): Promise<LessonSearchResult[]> {
  const params = new URLSearchParams({ q: query, limit: '10' });
  return apiClient.request(`/api/v1/search/lessons?${params.toString()}`, { signal });
}
