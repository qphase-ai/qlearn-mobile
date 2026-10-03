import { useQuery } from '@tanstack/react-query';

import { getHealth } from '@/lib/api/endpoints/health';

export const healthKeys = { api: ['health', 'api'] as const };

export function useApiHealth() {
  return useQuery({
    queryKey: healthKeys.api,
    queryFn: ({ signal }) => getHealth(signal),
    staleTime: 30_000,
    retry: false,
  });
}
