/** Client-side form checks. Supabase remains the authority on credentials. */

export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Enter your email address.';
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address.';
  return null;
}

/** For sign-in: existing passwords may predate our length rule. */
export function validatePasswordPresent(password: string): string | null {
  return password ? null : 'Enter your password.';
}

/** For new passwords (sign-up, reset). */
export function validateNewPassword(password: string): string | null {
  if (!password) return 'Choose a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

export function validatePasswordMatch(password: string, confirm: string): string | null {
  return password === confirm ? null : "Passwords don't match.";
}
