import { getTutorSession, sendTutorMessage } from '../tutor';

// jest.mock calls are hoisted above the imports by babel-jest.
jest.mock('@/lib/supabase/client', () => ({ getAccessToken: jest.fn(async () => 't'), getSupabase: jest.fn() }));

const respond = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body }) as Response;

let fetchSpy: jest.SpyInstance;
beforeEach(() => (fetchSpy = jest.spyOn(globalThis, 'fetch')));
afterEach(() => fetchSpy.mockRestore());

describe('tutor endpoints', () => {
  it('posts the chat request contract', async () => {
    fetchSpy.mockResolvedValue(respond(202, { success: true, data: { session_id: 's1', status: 'pending' } }));
    await sendTutorMessage({ message: 'Hi', session_id: 's1', lesson_id: null, circuit_context: null });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.test/api/v1/tutor/chat');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      message: 'Hi',
      session_id: 's1',
      lesson_id: null,
      circuit_context: null,
    });
  });

  it('treats an unused session (404) as an empty conversation', async () => {
    fetchSpy.mockResolvedValue(respond(404, { success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }));
    await expect(getTutorSession('new')).resolves.toEqual({ session_id: 'new', messages: [] });
  });

  it('surfaces other failures', async () => {
    fetchSpy.mockResolvedValue(respond(500, { success: false, error: { code: 'INTERNAL_ERROR', message: 'x' } }));
    await expect(getTutorSession('s1')).rejects.toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
