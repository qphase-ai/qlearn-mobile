import type { HealthResponse } from '@/types/contracts';

import { apiClient } from '../client';

/** `GET /health`: unauthenticated liveness probe; not wrapped in the envelope. */
export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiClient.request<HealthResponse>('/health', {
    auth: false,
    envelope: false,
    timeoutMs: 8_000,
    signal,
  });
}
