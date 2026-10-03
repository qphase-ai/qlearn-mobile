import { relativeTime } from '../time';

describe('relativeTime', () => {
  const now = 1_000_000_000_000;
  it('formats recent times compactly', () => {
    expect(relativeTime(now - 10_000, now)).toBe('Just now');
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 h ago');
    expect(relativeTime(now - 26 * 3_600_000, now)).toBe('Yesterday');
    expect(relativeTime(now - 72 * 3_600_000, now)).toBe('3 days ago');
  });
});
