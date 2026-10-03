import { Redirect } from 'expo-router';

/**
 * OAuth redirect landing (`qlearn://auth/callback`). The code is exchanged by
 * `signInWithGoogle` from the auth-session result. Android can also route the
 * deep link here, so just return to the root and let the auth guard decide.
 */
export default function AuthCallback() {
  return <Redirect href="/" />;
}
