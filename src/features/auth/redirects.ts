/**
 * Supabase sends users back to the app with either `?code=` (PKCE OAuth and
 * password recovery) or `?error=&error_description=`, in the query string or
 * the fragment. Pure parsing, so the deep-link handling is testable.
 */

export interface AuthCallbackParams {
  code: string | null;
  error: string | null;
}

function paramsOf(url: string): URLSearchParams {
  const merged = new URLSearchParams();
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : '';
  for (const part of [query, hash]) {
    new URLSearchParams(part).forEach((value, key) => merged.set(key, value));
  }
  return merged;
}

export function parseAuthCallback(url: string): AuthCallbackParams {
  const params = paramsOf(url);
  const error = params.get('error_description') ?? params.get('error');
  return { code: params.get('code'), error: error ? error.replace(/\+/g, ' ') : null };
}
