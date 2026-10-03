import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { apiClient } from '@/lib/api/client';
import { getSupabase } from '@/lib/supabase/client';
import { useTutorStore } from '@/stores/tutor-store';

import { signOut } from './auth-api';

interface AuthState {
  session: Session | null;
  user: User | null;
  /** True until the persisted session has been read from SecureStore. */
  isLoading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/**
 * Source of truth for "is someone signed in": the supabase-js session, which
 * is restored from SecureStore on launch and refreshed in the foreground.
 * The navigation guards in app/_layout.tsx key off `session`.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ session: null, user: null, isLoading: true });

  useEffect(() => {
    const supabase = getSupabase();
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setState({ session: data.session, user: data.session?.user ?? null, isLoading: false });
      })
      .catch(() => {
        // Unreadable storage: start signed out rather than hang on the splash.
        if (mounted) setState({ session: null, user: null, isLoading: false });
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setState({ session, user: session?.user ?? null, isLoading: false });
      // Never show one account's cached data to another.
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        // The tutor conversation index is per-account: drop it with the session.
        useTutorStore.setState({ activeSessionId: null, conversations: [], context: null });
      }
    });

    // A request still unauthorized after a token refresh means the session
    // was revoked server-side: sign out so the guard returns to login.
    apiClient.setUnauthorizedHandler(() => {
      void signOut().catch(() => undefined);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      apiClient.setUnauthorizedHandler(null);
    };
  }, [queryClient]);

  return <AuthContext value={state}>{children}</AuthContext>;
}
