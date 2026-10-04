import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { setLinkAuthState, takePendingHref } from './pending-href';

/**
 * Root navigator hook: reports the auth state to pending-href.ts and, once
 * signed in (email, Google or a restored session), replaces the screen with
 * the remembered link. Runs after the render that flips the Stack.Protected
 * guards, so the target route is registered by then.
 */
export function usePendingHrefReplay(ready: boolean, signedIn: boolean): void {
  useEffect(() => {
    if (!ready) return;
    setLinkAuthState(signedIn);
    if (!signedIn) return;
    let cancelled = false;
    void takePendingHref().then((href) => {
      if (!cancelled && href) router.replace(href as Href);
    });
    return () => {
      cancelled = true;
    };
  }, [ready, signedIn]);
}
