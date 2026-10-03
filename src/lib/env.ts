/**
 * Public client configuration.
 *
 * Only `EXPO_PUBLIC_*` values reach the bundle, and Metro inlines them only
 * on literal `process.env.EXPO_PUBLIC_X` access, so keep these reads static.
 * Nothing here is secret: privileged keys stay on the FastAPI backend.
 */

export type ContentSource = 'legacy' | 'cms';

export interface AppEnv {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  contentSource: ContentSource;
  contentUrl: string | null;
}

type RawEnv = Record<string, string | undefined>;

export class EnvError extends Error {}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function requireUrl(raw: RawEnv, name: string): string {
  const value = raw[name]?.trim();
  if (!value) {
    throw new EnvError(`${name} is not set. Copy .env.example to .env.local and fill it in.`);
  }
  if (!/^https?:\/\/[^\s]+$/i.test(value)) {
    throw new EnvError(`${name} must be an http(s) URL, got "${value}".`);
  }
  return trimSlash(value);
}

/** Validate a raw env map. Exported for tests; the app uses `getEnv()`. */
export function parseEnv(raw: RawEnv): AppEnv {
  const supabaseAnonKey = raw.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseAnonKey) {
    throw new EnvError(
      'EXPO_PUBLIC_SUPABASE_ANON_KEY is not set. Use the same anon key as the web app.'
    );
  }
  const contentSource: ContentSource =
    raw.EXPO_PUBLIC_CONTENT_SOURCE?.trim() === 'cms' ? 'cms' : 'legacy';

  return {
    apiUrl: requireUrl(raw, 'EXPO_PUBLIC_API_URL'),
    supabaseUrl: requireUrl(raw, 'EXPO_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey,
    contentSource,
    contentUrl:
      contentSource === 'cms' ? requireUrl(raw, 'EXPO_PUBLIC_CONTENT_URL') : null,
  };
}

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = parseEnv({
      EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_CONTENT_SOURCE: process.env.EXPO_PUBLIC_CONTENT_SOURCE,
      EXPO_PUBLIC_CONTENT_URL: process.env.EXPO_PUBLIC_CONTENT_URL,
    });
  }
  return cached;
}
