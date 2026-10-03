import { act, renderHook, waitFor } from '@testing-library/react-native';

import { ApiError } from '@/lib/api/errors';

import { CircuitRunError, RESULT_TIMEOUT_MS, SIMULATION_FAILED, useCircuitRun } from '../useCircuitRun';

const events: string[] = [];
let handlers: Record<string, (payload: unknown) => void> = {};
let resolveReady: () => void = () => undefined;
const mockUnsubscribe = jest.fn();

jest.mock('expo-crypto', () => ({ randomUUID: () => 'circuit-1' }));
jest.mock('@/lib/realtime/broadcast', () => ({
  subscribeBroadcast: (channel: string, h: Record<string, (p: unknown) => void>) => {
    events.push(`subscribe:${channel}`);
    handlers = h;
    return {
      ready: new Promise<void>((r) => (resolveReady = r)),
      unsubscribe: () => {
        events.push('unsubscribe');
        mockUnsubscribe();
      },
    };
  },
}));
const mockExecute = jest.fn();
jest.mock('@/lib/api/endpoints/circuits', () => ({
  executeCircuit: (...args: unknown[]) => {
    events.push('post');
    return mockExecute(...args);
  },
}));

const spec = { qubits: 1, classical_bits: 1, gates: [{ type: 'H', targets: [0] }] };

beforeEach(() => {
  events.length = 0;
  mockExecute.mockReset().mockResolvedValue({ execution_id: 'e1', status: 'pending' });
  mockUnsubscribe.mockReset();
});

async function start() {
  const hook = await renderHook(() => useCircuitRun());
  let pending!: Promise<void>;
  await act(async () => {
    pending = hook.result.current.run(spec, 1024, 'Lesson simulation');
  });
  return { ...hook, pending };
}

describe('useCircuitRun', () => {
  it('subscribes before posting and shows the broadcast result', async () => {
    const { result, pending } = await start();
    expect(result.current.state.status).toBe('running');
    expect(events).toEqual(['subscribe:circuit:circuit-1']);

    await act(async () => {
      resolveReady();
      await pending;
    });
    expect(events).toEqual(['subscribe:circuit:circuit-1', 'post']);
    expect(mockExecute).toHaveBeenCalledWith('circuit-1', { circuit: spec, shots: 1024, name: 'Lesson simulation' });

    const payload = { status: 'completed', probabilities: { '0': 0.5, '1': 0.5 }, measurements: null, statevector: null, execution_time_ms: 12 };
    await act(async () => handlers.result(payload));
    expect(result.current.state).toEqual({ status: 'done', result: payload });
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('hides backend failure detail behind a friendly message', async () => {
    const { result, pending } = await start();
    await act(async () => {
      resolveReady();
      await pending;
    });
    await act(async () => handlers.result({ status: 'failed', error_message: 'Traceback /srv/sandbox.py' }));
    const state = result.current.state;
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.error).toBeInstanceOf(CircuitRunError);
      expect((state.error as Error).message).toBe(SIMULATION_FAILED);
    }
  });

  it('reports a rejected POST and cleans up the channel', async () => {
    mockExecute.mockRejectedValue(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Circuit validation failed' }));
    const { result, pending } = await start();
    await act(async () => {
      resolveReady();
      await pending;
    });
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('times out when no result arrives', async () => {
    jest.useFakeTimers();
    try {
      const { result, pending } = await start();
      await act(async () => {
        resolveReady();
        await pending;
      });
      await act(async () => {
        jest.advanceTimersByTime(RESULT_TIMEOUT_MS);
      });
      expect(result.current.state.status).toBe('error');
      expect(mockUnsubscribe).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
