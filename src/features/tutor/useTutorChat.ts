import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getTutorSession, sendTutorMessage } from '@/lib/api/endpoints/tutor';
import { subscribeBroadcast } from '@/lib/realtime/broadcast';
import { useTutorStore } from '@/stores/tutor-store';
import type { Citation, TutorCompletePayload, TutorMessageOut, TutorSessionResponse } from '@/types/contracts';

/**
 * The AI Tutor conversation. Same backend contract as the web: subscribe to
 * `tutor:{session_id}` → POST /tutor/chat (202) → `token`… then `complete`.
 * Unlike the web, one session id is reused for the whole conversation so the
 * server-side history gives the model context. All LLM work is server-side.
 */

export const tutorKeys = {
  session: (id: string) => ['tutor', 'session', id] as const,
};

export const FLUSH_MS = 50;
/** If `complete` never arrives (backgrounded app, dropped socket), recover from the API once. */
export const COMPLETE_TIMEOUT_MS = 90_000;

export class TutorError extends Error {}
export const TUTOR_UNAVAILABLE = 'The AI Tutor is temporarily unavailable. Please try again in a moment.';
export const TUTOR_TIMEOUT = 'The AI Tutor took too long to answer. Please try again.';

export interface PendingTurn {
  question: string;
  answer: string;
  status: 'streaming' | 'error';
  error?: unknown;
}

export function useTutorSession(sessionId: string | null) {
  return useQuery({
    queryKey: tutorKeys.session(sessionId ?? ''),
    queryFn: ({ signal }) => getTutorSession(sessionId as string, signal),
    enabled: !!sessionId,
    // Updated explicitly when an answer completes; never refetched mid-stream.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useTutorChat() {
  const queryClient = useQueryClient();
  const sessionId = useTutorStore((s) => s.activeSessionId);
  const session = useTutorSession(sessionId);
  const [pending, setPending] = useState<PendingTurn | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  /** Session the in-flight (or failed) turn belongs to. */
  const turnSessionRef = useRef<string | null>(null);

  // Switching to another conversation abandons the in-flight turn. (Starting
  // the first turn also changes sessionId, from null to its new id: keep it.)
  useEffect(() => {
    if (turnSessionRef.current && turnSessionRef.current !== sessionId) {
      cleanupRef.current?.();
      cleanupRef.current = null;
      turnSessionRef.current = null;
      setPending(null);
    }
  }, [sessionId]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    []
  );

  const send = useCallback(
    async (rawQuestion: string) => {
      const question = rawQuestion.trim();
      if (!question || cleanupRef.current) return;

      const store = useTutorStore.getState();
      const sid = store.ensureSession();
      turnSessionRef.current = sid;
      const context = store.context;
      const key = tutorKeys.session(sid);

      let buffer = '';
      let done = false;
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      let completeTimer: ReturnType<typeof setTimeout> | null = null;

      setPending({ question, answer: '', status: 'streaming' });

      const flush = () => {
        flushTimer = null;
        setPending((p) => (p && p.status === 'streaming' ? { ...p, answer: buffer } : p));
      };

      const subscription = subscribeBroadcast(`tutor:${sid}`, {
        token: (payload) => {
          if (done) return;
          buffer += (payload as { token?: string }).token ?? '';
          if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
        },
        complete: (payload) => {
          if (done) return;
          const result = payload as TutorCompletePayload;
          if (result.error && !result.content) {
            fail(new TutorError(TUTOR_UNAVAILABLE));
            return;
          }
          finish();
          const content = result.content ?? buffer;
          const citations: Citation[] = result.citations ?? [];
          queryClient.setQueryData<TutorSessionResponse>(key, (old) => ({
            session_id: sid,
            messages: [
              ...(old?.messages ?? []),
              { role: 'user', content: question, citations: [] },
              { role: 'assistant', content, citations },
            ],
          }));
          setPending(null);
        },
      });

      function finish() {
        done = true;
        if (flushTimer) clearTimeout(flushTimer);
        if (completeTimer) clearTimeout(completeTimer);
        subscription.unsubscribe();
        cleanupRef.current = null;
      }

      function fail(error: unknown) {
        if (done) return;
        finish();
        setPending({ question, answer: '', status: 'error', error });
      }

      cleanupRef.current = () => {
        done = true;
        if (flushTimer) clearTimeout(flushTimer);
        if (completeTimer) clearTimeout(completeTimer);
        subscription.unsubscribe();
      };

      try {
        await subscription.ready;
        if (done) return;
        await sendTutorMessage({
          message: question,
          session_id: sid,
          lesson_id: context?.lessonId ?? null,
          circuit_context: context?.kind === 'circuit' ? context.source : null,
        });
        if (done) return;
        useTutorStore.getState().recordMessage(sid, question);
        completeTimer = setTimeout(() => void recover(), COMPLETE_TIMEOUT_MS);
      } catch (error) {
        fail(error);
      }

      // The answer may have been persisted even though the broadcast was missed.
      async function recover() {
        if (done) return;
        finish();
        try {
          const fresh = await getTutorSession(sid);
          const last = fresh.messages[fresh.messages.length - 1];
          if (last && last.role === 'assistant') {
            queryClient.setQueryData(key, fresh);
            setPending(null);
            return;
          }
        } catch {
          // fall through to the timeout message
        }
        setPending({ question, answer: '', status: 'error', error: new TutorError(TUTOR_TIMEOUT) });
      }
    },
    [queryClient]
  );

  const retry = useCallback(() => {
    if (pending?.status === 'error') void send(pending.question);
  }, [pending, send]);

  const messages: TutorMessageOut[] = session.data?.messages ?? [];
  return { sessionId, session, messages, pending, send, retry, isStreaming: pending?.status === 'streaming' };
}
