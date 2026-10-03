import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { ApiError } from '@/lib/api/errors';
import { useTutorStore } from '@/stores/tutor-store';

import { COMPLETE_TIMEOUT_MS, FLUSH_MS, TUTOR_TIMEOUT, TUTOR_UNAVAILABLE, TutorError, tutorKeys, useTutorChat } from '../useTutorChat';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'session-1' }));

const events: string[] = [];
let handlers: Record<string, (payload: unknown) => void> = {};
let resolveReady: () => void = () => undefined;
jest.mock('@/lib/realtime/broadcast', () => ({
  subscribeBroadcast: (channel: string, h: Record<string, (p: unknown) => void>) => {
    events.push(`subscribe:${channel}`);
    handlers = h;
    return { ready: new Promise<void>((r) => (resolveReady = r)), unsubscribe: () => events.push('unsubscribe') };
  },
}));
const mockSend = jest.fn();
const mockGetSession = jest.fn();
jest.mock('@/lib/api/endpoints/tutor', () => ({
  sendTutorMessage: (...args: unknown[]) => {
    events.push('post');
    return mockSend(...args);
  },
  getTutorSession: (...args: unknown[]) => mockGetSession(...args),
}));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

async function startTurn(question = 'What is a qubit?') {
  const { queryClient, wrapper } = setup();
  const hook = await renderHook(() => useTutorChat(), { wrapper });
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.result.current.send(question);
  });
  await act(async () => {
    resolveReady();
    await pending;
  });
  return { ...hook, queryClient };
}

beforeEach(() => {
  jest.useFakeTimers();
  events.length = 0;
  mockSend.mockReset().mockResolvedValue({ session_id: 'session-1', status: 'pending' });
  mockGetSession.mockReset().mockResolvedValue({ session_id: 'session-1', messages: [] });
  useTutorStore.setState({ activeSessionId: null, conversations: [], context: null });
});
afterEach(() => jest.useRealTimers());

describe('useTutorChat', () => {
  it('subscribes before posting, streams batched tokens and stores the answer', async () => {
    useTutorStore.setState({ context: { kind: 'circuit', title: 'Bell', source: 'qc.h(0)' } });
    const { result, queryClient } = await startTurn();

    expect(events.slice(0, 2)).toEqual(['subscribe:tutor:session-1', 'post']);
    expect(mockSend).toHaveBeenCalledWith({
      message: 'What is a qubit?',
      session_id: 'session-1',
      lesson_id: null,
      circuit_context: 'qc.h(0)',
    });
    // The first message created the session; the turn must survive that.
    expect(result.current.pending).toMatchObject({ question: 'What is a qubit?', status: 'streaming' });

    await act(async () => {
      handlers.token({ token: 'A qubit ' });
      handlers.token({ token: 'is…' });
    });
    expect(result.current.pending?.answer).toBe('');
    await act(async () => {
      jest.advanceTimersByTime(FLUSH_MS);
    });
    expect(result.current.pending?.answer).toBe('A qubit is…');

    const citations = [{ title: 'Qubits', url: null, score: 0.9 }];
    await act(async () => handlers.complete({ message_id: 'm1', content: 'A qubit is a two-level system.', citations }));
    expect(result.current.pending).toBeNull();
    expect(queryClient.getQueryData(tutorKeys.session('session-1'))).toEqual({
      session_id: 'session-1',
      messages: [
        { role: 'user', content: 'What is a qubit?', citations: [] },
        { role: 'assistant', content: 'A qubit is a two-level system.', citations },
      ],
    });
    expect(useTutorStore.getState().conversations[0]).toMatchObject({ id: 'session-1', title: 'What is a qubit?' });
    expect(events).toContain('unsubscribe');
  });

  it('shows a friendly error when the tutor reports a failure', async () => {
    const { result } = await startTurn();
    await act(async () => handlers.complete({ error: 'litellm.RateLimitError: groq 429' }));
    expect(result.current.pending?.status).toBe('error');
    expect(result.current.pending?.error).toBeInstanceOf(TutorError);
    expect((result.current.pending?.error as Error).message).toBe(TUTOR_UNAVAILABLE);
  });

  it('keeps the question for retry when the POST fails', async () => {
    mockSend.mockRejectedValue(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'offline' }));
    const { result } = await startTurn('Explain H');
    expect(result.current.pending).toMatchObject({ question: 'Explain H', status: 'error' });
    expect(useTutorStore.getState().conversations).toHaveLength(0);

    mockSend.mockResolvedValue({ session_id: 'session-1', status: 'pending' });
    await act(async () => {
      result.current.retry();
    });
    await act(async () => {
      resolveReady();
    });
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(result.current.pending?.status).toBe('streaming');
  });

  it('recovers a persisted answer when the complete event is missed', async () => {
    const { result, queryClient } = await startTurn();
    const persisted = {
      session_id: 'session-1',
      messages: [
        { role: 'user', content: 'What is a qubit?', citations: [] },
        { role: 'assistant', content: 'Recovered answer', citations: [] },
      ],
    };
    mockGetSession.mockResolvedValue(persisted);
    await act(async () => {
      jest.advanceTimersByTime(COMPLETE_TIMEOUT_MS);
    });
    expect(result.current.pending).toBeNull();
    expect(queryClient.getQueryData(tutorKeys.session('session-1'))).toEqual(persisted);
  });

  it('times out when nothing was persisted either', async () => {
    const { result } = await startTurn();
    mockGetSession.mockResolvedValue({ session_id: 'session-1', messages: [{ role: 'user', content: 'q', citations: [] }] });
    await act(async () => {
      jest.advanceTimersByTime(COMPLETE_TIMEOUT_MS);
    });
    expect((result.current.pending?.error as Error).message).toBe(TUTOR_TIMEOUT);
  });
});
