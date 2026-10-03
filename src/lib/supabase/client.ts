import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { getEnv } from '@/lib/env';
import { secureStorage } from '@/lib/storage/secure-storage';

import { installCryptoPolyfills } from './polyfills';

installCryptoPolyfills();

/**
 * The same Supabase project and anon key as the web app, so one account works
 * on both clients. Used only for Auth and Realtime subscriptions: all data
 * access goes through FastAPI (see docs/architecture-audit.md §4).
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = getEnv();
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Native apps have no URL to read a session from. OAuth and recovery
        // links are completed explicitly in features/auth/auth-api.ts.
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });

    // Run the token refresh loop only while the app is in the foreground.
    if (Platform.OS !== 'web') {
      AppState.addEventListener('change', (state) => {
        if (state === 'active') void client?.auth.startAutoRefresh();
        else void client?.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}

/** The current access token, refreshed by supabase-js as needed. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}
