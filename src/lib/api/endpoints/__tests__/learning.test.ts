import { getLesson, listCourses, searchLessons, updateLessonProgress } from '../learning';

// jest.mock calls below are hoisted above this import by babel-jest.
const mockEnv = { contentSource: 'legacy' as 'legacy' | 'cms', contentUrl: null as string | null };

jest.mock('@/lib/env', () => ({
  getEnv: () => ({
    apiUrl: 'https://api.test',
    supabaseUrl: 'https://supabase.test',
    supabaseAnonKey: 'anon',
    ...mockEnv,
  }),
}));
jest.mock('@/lib/supabase/client', () => ({
  getAccessToken: jest.fn(async () => 'user-token'),
  getSupabase: jest.fn(),
}));

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) }) as Response;

let fetchSpy: jest.SpyInstance;
beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(ok([]));
});
afterEach(() => fetchSpy.mockRestore());

const call = (i = 0) => ({
  url: fetchSpy.mock.calls[i][0] as string,
  headers: (fetchSpy.mock.calls[i][1] as RequestInit).headers as Record<string, string>,
});

describe('content source routing', () => {
  it('reads legacy content from FastAPI with the user token', async () => {
    mockEnv.contentSource = 'legacy';
    await listCourses();
    expect(call().url).toBe('https://api.test/api/v1/courses');
    expect(call().headers.Authorization).toBe('Bearer user-token');
  });

  it('reads CMS content anonymously from the web app', async () => {
    mockEnv.contentSource = 'cms';
    mockEnv.contentUrl = 'https://web.test';
    await getLesson('payload:7');
    expect(call().url).toBe('https://web.test/api/cms/lessons/payload%3A7');
    expect(call().headers.Authorization).toBeUndefined();
  });

  it('always sends learner state to FastAPI', async () => {
    mockEnv.contentSource = 'cms';
    mockEnv.contentUrl = 'https://web.test';
    fetchSpy.mockResolvedValue(ok({ lesson_id: 'l1', status: 'completed', completion_pct: 100 }));
    await updateLessonProgress('l1', { status: 'completed', completion_pct: 100 });
    expect(call().url).toBe('https://api.test/api/v1/lessons/l1/progress');
    expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe('PUT');

    await searchLessons('bell state');
    expect(call(1).url).toBe('https://api.test/api/v1/search/lessons?q=bell+state&limit=10');
  });
});
