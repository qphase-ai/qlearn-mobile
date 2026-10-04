import { isValidContentId, isValidLessonId, protectedHref, toAppPath } from '../links';

const UUID = '0b6f1f6e-1111-4c1e-9f00-000000000001';

describe('toAppPath', () => {
  it.each([
    ['qlearn://lesson/x', '/lesson/x'],
    ['qlearn://', '/'],
    ['exp://192.168.1.2:8081/--/level/y?courseId=z', '/level/y?courseId=z'],
    ['/learn', '/learn'],
  ])('%s → %s', (input, path) => expect(toAppPath(input)).toBe(path));

  it('ignores web and other schemes (no universal links)', () => {
    expect(toAppPath('https://qlearn.app/lesson/x')).toBeNull();
    expect(toAppPath('other://lesson/x')).toBeNull();
  });
});

describe('ids', () => {
  it('accepts only UUIDs from the legacy source', () => {
    expect(isValidLessonId(UUID, 'legacy')).toBe(true);
    expect(isValidLessonId('payload:12', 'legacy')).toBe(false);
    expect(isValidContentId(UUID, 'legacy')).toBe(true);
    expect(isValidContentId('12', 'legacy')).toBe(false);
  });

  it('also accepts Payload ids from the CMS source', () => {
    expect(isValidLessonId('payload:12', 'cms')).toBe(true);
    expect(isValidLessonId(UUID, 'cms')).toBe(true);
    expect(isValidLessonId('12', 'cms')).toBe(false);
    expect(isValidLessonId('payload:../x', 'cms')).toBe(false);
    expect(isValidContentId('12', 'cms')).toBe(true);
    expect(isValidContentId('a'.repeat(65), 'cms')).toBe(false);
    expect(isValidContentId('1;drop', 'cms')).toBe(false);
  });
});

describe('protectedHref', () => {
  it.each([
    ['qlearn://', '/'],
    ['qlearn://learn', '/learn'],
    ['qlearn://build', '/build'],
    ['qlearn://tutor', '/tutor'],
    ['qlearn://profile', '/profile'],
    [`qlearn://lesson/${UUID}`, `/lesson/${UUID}`],
    [`qlearn://level/${UUID}?courseId=${UUID}&x=1`, `/level/${UUID}?courseId=${UUID}`],
  ])('accepts %s', (input, href) => expect(protectedHref(input)).toBe(href));

  it.each([
    'qlearn://auth/callback?code=abc',
    'qlearn://reset-password?code=abc',
    'qlearn://quiz/abc',
    `qlearn://circuit/${UUID}`,
    'qlearn://lesson/not-a-uuid',
    'qlearn://lesson',
    `qlearn://lesson/${UUID}/extra`,
    `qlearn://lesson/${UUID}?courseId=..%2F`,
    'qlearn://learn/extra',
    'qlearn://lesson/%E0%A4%A',
    'https://qlearn.app/learn',
  ])('rejects %s', (input) => expect(protectedHref(input)).toBeNull());
});
