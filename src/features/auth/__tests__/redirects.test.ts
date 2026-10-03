import { parseAuthCallback } from '../redirects';

describe('parseAuthCallback', () => {
  it('reads a PKCE code from the query string', () => {
    expect(parseAuthCallback('qlearn://auth/callback?code=abc123')).toEqual({ code: 'abc123', error: null });
  });

  it('reads Expo Go style URLs', () => {
    expect(parseAuthCallback('exp://192.168.1.2:8081/--/reset-password?code=xyz')).toEqual({
      code: 'xyz',
      error: null,
    });
  });

  it('prefers error_description from the fragment', () => {
    const url = 'qlearn://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
    expect(parseAuthCallback(url)).toEqual({ code: null, error: 'Email link is invalid or has expired' });
  });

  it('returns nulls when nothing is present', () => {
    expect(parseAuthCallback('qlearn://auth/callback')).toEqual({ code: null, error: null });
  });
});
