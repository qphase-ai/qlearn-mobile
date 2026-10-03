import type { TutorChatAccepted, TutorChatRequest, TutorSessionResponse } from '@/types/contracts';

import { apiClient } from '../client';
import { isApiError } from '../errors';

/**
 * `POST /api/v1/tutor/chat` → 202. The answer streams on the Realtime channel
 * `tutor:{session_id}` (events `token`, `complete`); subscribe first.
 */
export function sendTutorMessage(body: TutorChatRequest): Promise<TutorChatAccepted> {
  return apiClient.request('/api/v1/tutor/chat', { method: 'POST', body, timeoutMs: 20_000 });
}

/**
 * `GET /api/v1/tutor/sessions/{id}`: persisted history. A session id that
 * has not been used yet 404s; that is simply an empty conversation.
 */
export async function getTutorSession(sessionId: string, signal?: AbortSignal): Promise<TutorSessionResponse> {
  try {
    return await apiClient.request(`/api/v1/tutor/sessions/${encodeURIComponent(sessionId)}`, { signal });
  } catch (error) {
    if (isApiError(error) && error.code === 'NOT_FOUND') return { session_id: sessionId, messages: [] };
    throw error;
  }
}
