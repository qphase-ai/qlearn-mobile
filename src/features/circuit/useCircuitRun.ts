import { randomUUID } from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import { executeCircuit } from '@/lib/api/endpoints/circuits';
import { subscribeBroadcast } from '@/lib/realtime/broadcast';
import type { CircuitSpec, SimulationResult } from '@/types/contracts';

/**
 * Run a circuit on the Q-Learn quantum backend and wait for its Realtime
 * result. Flow (same as the web): mint circuit id → subscribe to
 * `circuit:{id}` → POST execute → result broadcast. Nothing runs on device.
 */

export type CircuitRunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: SimulationResult }
  | { status: 'error'; error: unknown };

/** Sandbox limit is 30s; allow for queueing and the realtime hop. */
export const RESULT_TIMEOUT_MS = 60_000;

export class CircuitRunError extends Error {}

export const SIMULATION_FAILED = "The quantum simulator couldn't run this circuit. Please try again.";

export function useCircuitRun() {
  const [state, setState] = useState<CircuitRunState>({ status: 'idle' });
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  const run = useCallback(async (circuit: CircuitSpec, shots: number, name: string) => {
    cleanup.current?.();
    setState({ status: 'running' });

    const circuitId = randomUUID();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const subscription = subscribeBroadcast(`circuit:${circuitId}`, {
      result: (payload) => {
        if (settled) return;
        settled = true;
        finish();
        const result = payload as SimulationResult;
        // The backend's error_message stays out of the UI (it can carry
        // sandbox detail); students get a plain explanation.
        setState(
          result.status === 'failed'
            ? { status: 'error', error: new CircuitRunError(SIMULATION_FAILED) }
            : { status: 'done', result }
        );
      },
    });
    const finish = () => {
      if (timer) clearTimeout(timer);
      subscription.unsubscribe();
      cleanup.current = null;
    };
    cleanup.current = () => {
      settled = true;
      finish();
    };

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      finish();
      setState({ status: 'error', error });
    };

    try {
      await subscription.ready;
      if (settled) return;
      await executeCircuit(circuitId, { circuit, shots, name });
      timer = setTimeout(
        () => fail(new CircuitRunError('The simulation took too long. Please try again.')),
        RESULT_TIMEOUT_MS
      );
    } catch (error) {
      fail(error);
    }
  }, []);

  return { state, run };
}
