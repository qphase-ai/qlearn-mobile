/**
 * Student-facing copy for Supabase Auth failures. Supabase's own messages
 * ("Invalid login credentials", "User already registered") are written for
 * end users, so they pass through. Transport failures are rewritten.
 */
export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (!message) return 'Something went wrong. Please try again.';
  if (/network|fetch|timed? ?out|offline/i.test(message)) {
    return "Can't reach Q-Learn. Check your connection and try again.";
  }
  if (/code verifier|code_verifier|flow state/i.test(message)) {
    return 'This link must be opened on the device where you requested it. Please request a new one.';
  }
  if (/rate limit|too many/i.test(message)) {
    return 'Too many attempts. Please wait a minute, then try again.';
  }
  return message;
}
