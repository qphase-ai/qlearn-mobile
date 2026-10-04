import { captureSystemLink } from '@/features/linking/pending-href';

/**
 * Every system link (cold and warm start) passes through here before the
 * router opens it. A signed-in-only link opened while signed out is lost to
 * the login redirect, so remember it for after sign-in. The path is never
 * rewritten: routes validate their own params, and unknown paths reach
 * +not-found.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    captureSystemLink(path);
  } catch {
    // Never crash link handling (Expo's native-intent guidance).
  }
  return path;
}
