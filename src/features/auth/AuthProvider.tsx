import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';

import { clearPendingHref } from '@/features/linking/pending-href';
import { resetReminder } from '@/features/notifications/reminders';
import { apiClient } from '@/lib/api/client';
import { clearPersistedCache, setPersistOwner } from '@/lib/query/persist';
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

    // Cached server data, queued completions and the on-disk copy belong to
    // one account. Wipe them whenever the account changes or nobody is signed
    // in, so they are never shown to (or sent as) someone else.
    let owner: string | null = null;
    const wipe = () => {
      queryClient.clear(); // queries and queued mutations
      void clearPersistedCache().catch(() => undefined);
      // The tutor conversation index is per-account too.
      useTutorStore.setState({ activeSessionId: null, conversations: [], context: null });
      // So is the study reminder: cancel it and reset the preference.
      void resetReminder().catch(() => undefined);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setState({ session, user: session?.user ?? null, isLoading: false });
      const userId = session?.user.id ?? null;
      const signedOut = event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !userId);
      // On launch `owner` is unknown: the persister's restore already checked
      // the cache against this session.
      const switched = (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && !!owner && owner !== userId;
      if (signedOut || switched) {
        setPersistOwner(null); // saves triggered by the wipe must not be stamped
        wipe();
      }
      // Only when someone was signed in: auth-js can also emit SIGNED_OUT at
      // launch (a refresh token that no longer works), and a link opened
      // before or during that launch must survive it.
      if (event === 'SIGNED_OUT' && owner) clearPendingHref();
      owner = userId;
      setPersistOwner(userId);
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
