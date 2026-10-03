import { randomUUID } from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Client state for the tutor: which conversation is open, a device-local
 * index of past conversations (the backend has no "list sessions" endpoint
 * yet, audit §13), and the context the next question is asked in. The
 * messages themselves are server state (`GET /tutor/sessions/{id}`).
 */

export interface TutorConversation {
  id: string;
  title: string;
  updatedAt: number;
}

export type TutorContext =
  | { kind: 'lesson'; lessonId: string; title: string }
  | { kind: 'circuit'; title: string; source: string; lessonId?: string };

export const MAX_CONVERSATIONS = 30;
const TITLE_MAX = 80;

interface TutorState {
  activeSessionId: string | null;
  conversations: TutorConversation[];
  context: TutorContext | null;
  /** The session to send into, creating one if none is open. */
  ensureSession: () => string;
  startNewConversation: () => void;
  openConversation: (id: string) => void;
  /** Upsert the index entry after a message is sent (title = first question). */
  recordMessage: (id: string, question: string, now?: number) => void;
  removeConversation: (id: string) => void;
  setContext: (context: TutorContext | null) => void;
}

export function conversationTitle(question: string): string {
  const oneLine = question.replace(/\s+/g, ' ').trim();
  return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1)}…` : oneLine;
}

export const useTutorStore = create<TutorState>()(
  persist(
    (set, get) => ({
      activeSessionId: null,
      conversations: [],
      context: null,

      ensureSession: () => {
        const existing = get().activeSessionId;
        if (existing) return existing;
        const id = randomUUID();
        set({ activeSessionId: id });
        return id;
      },
      startNewConversation: () => set({ activeSessionId: null }),
      openConversation: (id) => set({ activeSessionId: id }),
      recordMessage: (id, question, now = Date.now()) =>
        set((s) => {
          const existing = s.conversations.find((c) => c.id === id);
          const entry: TutorConversation = {
            id,
            title: existing?.title ?? conversationTitle(question),
            updatedAt: now,
          };
          return {
            conversations: [entry, ...s.conversations.filter((c) => c.id !== id)].slice(0, MAX_CONVERSATIONS),
          };
        }),
      removeConversation: (id) =>
        set((s) => ({
          conversations: s.conversations.filter((c) => c.id !== id),
          activeSessionId: s.activeSessionId === id ? null : s.activeSessionId,
        })),
      setContext: (context) => set({ context }),
    }),
    {
      name: 'qlearn.tutor',
      storage: createJSONStorage(() => Storage),
      // Context is per-visit: never restore a stale "asking about X" chip.
      partialize: (s) => ({ activeSessionId: s.activeSessionId, conversations: s.conversations }),
    }
  )
);
