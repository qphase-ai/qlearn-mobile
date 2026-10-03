import type { ExecuteCircuitRequest, ExecutionAccepted } from '@/types/contracts';

import { apiClient } from '../client';

/**
 * `POST /api/v1/circuits/{circuit_id}/execute` → 202. Execution happens in the
 * backend's sandbox (never on device); the result arrives on the Realtime
 * channel `circuit:{circuit_id}`, event `result`.
 */
export function executeCircuit(circuitId: string, body: ExecuteCircuitRequest): Promise<ExecutionAccepted> {
  return apiClient.request(`/api/v1/circuits/${encodeURIComponent(circuitId)}/execute`, {
    method: 'POST',
    body,
  });
}
