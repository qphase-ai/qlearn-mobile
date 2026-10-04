import { updateLessonProgress } from '@/lib/api/endpoints/learning';
import type { ProgressItem } from '@/types/contracts';

import { isTrackableLessonId } from './curriculum';

/**
 * The lesson-completion request. Kept free of React so lib/query/client.ts can
 * register it as the mutationFn default for LESSON_COMPLETE_MUTATION_KEY: a
 * completion queued offline and restored after a restart can still run.
 */
export async function completeLesson(lessonId: string): Promise<ProgressItem> {
  if (!isTrackableLessonId(lessonId)) {
    throw new Error('Progress tracking is unavailable for this lesson.');
  }
  return updateLessonProgress(lessonId, { status: 'completed', completion_pct: 100 });
}
