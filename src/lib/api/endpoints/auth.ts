import type { UserResponse } from '@/types/contracts';

import { apiClient } from '../client';

/** `GET /api/v1/auth/me`: the synced local profile (provisions it on first call). */
export function getMe(signal?: AbortSignal): Promise<UserResponse> {
  return apiClient.request<UserResponse>('/api/v1/auth/me', { signal });
}
