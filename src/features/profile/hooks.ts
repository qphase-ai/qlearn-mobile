import { useQuery } from '@tanstack/react-query';

import { getMe } from '@/lib/api/endpoints/auth';
import { useAuth } from '@/features/auth/AuthProvider';

export const profileKeys = {
  me: (userId: string | undefined) => ['profile', 'me', userId] as const,
};

/** The profile is never persisted, so offline its card waits rather than erroring. */
export const ACCOUNT_OFFLINE = "Account details load when you're back online.";

/** The backend profile (`/auth/me`) for the signed-in user. */
export function useMe() {
  const { user } = useAuth();
  return useQuery({
    queryKey: profileKeys.me(user?.id),
    queryFn: ({ signal }) => getMe(signal),
    enabled: !!user,
  });
}
