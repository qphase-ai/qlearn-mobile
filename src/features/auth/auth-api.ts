import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getSupabase } from '@/lib/supabase/client';

import { parseAuthCallback } from './redirects';

/**
 * Thin wrappers over Supabase Auth: the same project and flows as the web
 * (frontend/src/hooks/useAuth.ts). FastAPI never sees credentials. It
 * verifies the access token and provisions the local user on the first
 * `/auth/me` call.
 *
 * Deep-link redirect URLs must be allow-listed in Supabase → Auth → URL
 * Configuration: `qlearn://auth/callback` and `qlearn://reset-password`
 * (plus the `exp://…/--/…` variants when testing in Expo Go).
 */

WebBrowser.maybeCompleteAuthSession();

export class AuthFlowError extends Error {}

export const redirectUrls = {
  oauth: () => Linking.createURL('auth/callback'),
  passwordReset: () => Linking.createURL('reset-password'),
};

function rethrow(error: { message: string } | null): void {
  if (error) throw new AuthFlowError(error.message);
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  rethrow(error);
}

/**
 * Create an account. Projects with email confirmation on return no session
 * until the address is confirmed, which `needsConfirmation` reports.
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<{ needsConfirmation: boolean }> {
  const name = displayName?.trim();
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    // Same metadata key the web sign-up writes.
    options: name ? { data: { display_name: name } } : undefined,
  });
  rethrow(error);
  return { needsConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  // Local scope: sign out this device only. The web session stays valid.
  const { error } = await getSupabase().auth.signOut({ scope: 'local' });
  rethrow(error);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectUrls.passwordReset(),
  });
  rethrow(error);
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  rethrow(error);
}

/** Exchange a `?code=` deep link (OAuth or recovery) for a session. */
export async function completeAuthFromUrl(url: string): Promise<void> {
  const { code, error } = parseAuthCallback(url);
  if (error) throw new AuthFlowError(error);
  if (!code) throw new AuthFlowError('This link is invalid or has expired.');
  const result = await getSupabase().auth.exchangeCodeForSession(code);
  rethrow(result.error);
}

/**
 * Google sign-in through the system browser (PKCE). Resolves `false` if the
 * user dismissed the browser. Uses the Google provider already configured
 * on the shared Supabase project for the web.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const redirectTo = redirectUrls.oauth();
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  rethrow(error);
  if (!data.url) throw new AuthFlowError('Google sign-in is unavailable right now.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  await completeAuthFromUrl(result.url);
  return true;
}
