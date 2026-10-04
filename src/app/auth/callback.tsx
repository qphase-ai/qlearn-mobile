import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

/**
 * OAuth redirect landing (`qlearn://auth/callback`). The code is exchanged by
 * `signInWithGoogle` from the auth-session result. Android can also route the
 * deep link here, on top of the screen the student came from: go back to it
 * rather than replace, which would stack a second login. Opened cold, go to a
 * screen the auth guard allows (home is protected, so signed out → login; the
 * guard swaps it for the tabs once the session lands).
 */
export default function AuthCallback() {
  const { session } = useAuth();
  const signedIn = !!session;
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace(signedIn ? '/' : '/login');
    // Once, on arrival: a later sign-in is handled by the guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
