import { authErrorMessage } from '../errors';

describe('authErrorMessage', () => {
  it('passes Supabase user-facing messages through', () => {
    expect(authErrorMessage(new Error('Invalid login credentials'))).toBe('Invalid login credentials');
  });

  it('rewrites transport failures', () => {
    expect(authErrorMessage(new Error('Failed to fetch'))).toMatch(/connection/);
  });

  it('explains PKCE links opened on another device', () => {
    expect(authErrorMessage(new Error('invalid request: both auth code and code verifier should be non-empty'))).toMatch(
      /same device|device where/
    );
  });

  it('has a fallback', () => {
    expect(authErrorMessage(undefined)).toMatch(/try again/);
  });
});
