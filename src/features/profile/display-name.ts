import type { User } from '@supabase/supabase-js';

/**
 * Friendly name for greetings. Uses `display_name` (written by the web and
 * mobile sign-up forms), then `full_name`/`name` (Google OAuth metadata), then
 * the email's local part.
 */
export function displayNameFor(user: Pick<User, 'email' | 'user_metadata'> | null): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of ['display_name', 'full_name', 'name']) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim().split(/\s+/)[0];
  }
  const local = user?.email?.split('@')[0];
  return local || 'there';
}
