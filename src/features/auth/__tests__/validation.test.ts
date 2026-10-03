import {
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validateNewPassword,
  validatePasswordMatch,
  validatePasswordPresent,
} from '../validation';

describe('auth validation', () => {
  it('validates email', () => {
    expect(validateEmail('')).toMatch(/enter/i);
    expect(validateEmail('nope')).toMatch(/valid/i);
    expect(validateEmail('  student@qlearn.ai ')).toBeNull();
  });

  it('only requires presence for sign-in passwords', () => {
    expect(validatePasswordPresent('')).not.toBeNull();
    expect(validatePasswordPresent('abc')).toBeNull();
  });

  it('enforces length for new passwords', () => {
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/);
    expect(validateNewPassword('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it('checks confirmation', () => {
    expect(validatePasswordMatch('abcdefgh', 'abcdefgi')).not.toBeNull();
    expect(validatePasswordMatch('abcdefgh', 'abcdefgh')).toBeNull();
  });
});
