import { displayNameFor } from '../display-name';

describe('displayNameFor', () => {
  it('prefers the sign-up display name', () => {
    expect(displayNameFor({ email: 'a@b.co', user_metadata: { display_name: 'Ada Lovelace' } })).toBe('Ada');
  });

  it('falls back to Google metadata, then the email', () => {
    expect(displayNameFor({ email: 'a@b.co', user_metadata: { full_name: 'Grace Hopper' } })).toBe('Grace');
    expect(displayNameFor({ email: 'qubit@b.co', user_metadata: {} })).toBe('qubit');
    expect(displayNameFor(null)).toBe('there');
  });
});
