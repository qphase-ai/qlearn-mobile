import { getEnv } from '@/lib/env';
import { getAccessToken, getSupabase } from '@/lib/supabase/client';

import { ApiError, errorFromResponse } from './errors';

/**
 * Typed client for the Q-Learn FastAPI backend. Screens never call this
 * directly; they go through feature hooks (TanStack Query) → endpoint
 * functions in `./endpoints` → here.
 */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  /** Attach the Supabase access token (default true). */
  auth?: boolean;
  /** Unwrap the `{success, data}` envelope (default true; `/health` has none). */
  envelope?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ApiClientDeps {
  baseUrl: () => string;
  getAccessToken: () => Promise<string | null>;
  /** Force a token refresh; resolves to the new token or null if the session is gone. */
  refreshAccessToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 15_000;

type UnauthorizedHandler = () => void;

export function createApiClient(deps: ApiClientDeps) {
  let onUnauthorized: UnauthorizedHandler | null = null;

  async function send(path: string, opts: RequestOptions, token: string | null) {
    const fetchImpl = deps.fetchImpl ?? fetch;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener('abort', onAbort);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      return await fetchImpl(`${deps.baseUrl()}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      if (opts.signal?.aborted) throw err; // caller cancelled (e.g. query unmounted)
      throw new ApiError({
        status: 0,
        code: timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: timedOut ? 'Request timed out' : 'Network request failed',
      });
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }

  async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    const useAuth = opts.auth ?? true;
    const token = useAuth ? await deps.getAccessToken() : null;
    let res = await send(path, opts, token);

    // Access tokens live ~1h. If the API rejects one, refresh once and retry
    // before treating the session as dead.
    if (res.status === 401 && useAuth) {
      const fresh = await deps.refreshAccessToken().catch(() => null);
      if (fresh) res = await send(path, opts, fresh);
      if (res.status === 401) onUnauthorized?.();
    }

    if (res.status === 204) return undefined as T;
    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) throw errorFromResponse(res.status, body);
    if (opts.envelope === false) return body as T;

    const env = body as { success?: boolean; data?: T } | null;
    if (!env || env.success !== true) throw errorFromResponse(res.status, body);
    return env.data as T;
  }

  return {
    request,
    /** Called when a request is still unauthorized after a refresh (session is dead). */
    setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
      onUnauthorized = handler;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const apiClient = createApiClient({
  baseUrl: () => getEnv().apiUrl,
  getAccessToken,
  refreshAccessToken: async () => {
    const { data, error } = await getSupabase().auth.refreshSession();
    return error ? null : (data.session?.access_token ?? null);
  },
});
