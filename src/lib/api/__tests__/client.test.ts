import { createApiClient, type ApiClientDeps } from '../client';
import { ApiError } from '../errors';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function setup(overrides: Partial<ApiClientDeps> = {}) {
  const fetchImpl = jest.fn();
  const deps: ApiClientDeps = {
    baseUrl: () => 'https://api.test',
    getAccessToken: jest.fn(async () => 'token-1'),
    refreshAccessToken: jest.fn(async () => 'token-2'),
    fetchImpl: fetchImpl as unknown as typeof fetch,
    ...overrides,
  };
  const client = createApiClient(deps);
  const onUnauthorized = jest.fn();
  client.setUnauthorizedHandler(onUnauthorized);
  return { client, fetchImpl, deps, onUnauthorized };
}

const headersOf = (fetchImpl: jest.Mock, call = 0) =>
  (fetchImpl.mock.calls[call][1] as RequestInit).headers as Record<string, string>;

describe('apiClient', () => {
  it('unwraps the success envelope and sends the bearer token', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(200, { success: true, data: { id: 'u1' }, message: 'OK' }));

    await expect(client.request('/api/v1/auth/me')).resolves.toEqual({ id: 'u1' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/api/v1/auth/me', expect.objectContaining({ method: 'GET' }));
    expect(headersOf(fetchImpl).Authorization).toBe('Bearer token-1');
  });

  it('serializes JSON bodies', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(200, { success: true, data: null }));
    await client.request('/x', { method: 'PUT', body: { completion_pct: 50 } });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"completion_pct":50}');
    expect(headersOf(fetchImpl)['Content-Type']).toBe('application/json');
  });

  it('skips the token for unauthenticated, unwrapped calls', async () => {
    const { client, fetchImpl, deps } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(200, { status: 'ok', service: 'Q-Learn API' }));

    await expect(client.request('/health', { auth: false, envelope: false })).resolves.toEqual({
      status: 'ok',
      service: 'Q-Learn API',
    });
    expect(deps.getAccessToken).not.toHaveBeenCalled();
    expect(headersOf(fetchImpl).Authorization).toBeUndefined();
  });

  it('resolves 204 No Content without parsing a body', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue({ ok: true, status: 204, json: async () => { throw new Error('empty'); } });
    await expect(client.request('/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('maps the Q-Learn error envelope to ApiError', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(
      jsonResponse(404, { success: false, error: { code: 'NOT_FOUND', message: 'Lesson x not found', details: null } })
    );
    await expect(client.request('/api/v1/lessons/x')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Lesson x not found',
    });
  });

  it("maps FastAPI's {detail} validation errors", async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(422, { detail: [{ loc: ['body', 'shots'], msg: 'bad' }] }));
    const err = (await client.request('/x').catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toEqual([{ loc: ['body', 'shots'], msg: 'bad' }]);
  });

  it('handles non-JSON error bodies', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } });
    await expect(client.request('/x')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('maps 429 to RATE_LIMITED', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockResolvedValue(jsonResponse(429, { detail: 'Too many requests' }));
    await expect(client.request('/x')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('turns transport failures into NETWORK_ERROR', async () => {
    const { client, fetchImpl } = setup();
    fetchImpl.mockRejectedValue(new TypeError('Network request failed'));
    await expect(client.request('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('times out slow requests', async () => {
    jest.useFakeTimers();
    try {
      const { client, fetchImpl } = setup();
      fetchImpl.mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          })
      );
      const pending = client.request('/slow', { timeoutMs: 1000 });
      // Let the token lookup resolve so fetch is actually in flight.
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(1000);
      await expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('refreshes once and retries on 401', async () => {
    const { client, fetchImpl, deps, onUnauthorized } = setup();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: 'ok' }));

    await expect(client.request('/x')).resolves.toBe('ok');
    expect(deps.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(headersOf(fetchImpl, 1).Authorization).toBe('Bearer token-2');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('signals unauthorized when the retry is still rejected', async () => {
    const { client, fetchImpl, onUnauthorized } = setup();
    const unauthorized = jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid' } });
    fetchImpl.mockResolvedValue(unauthorized);

    await expect(client.request('/x')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('signals unauthorized without retrying when refresh fails', async () => {
    const { client, fetchImpl, onUnauthorized } = setup({ refreshAccessToken: jest.fn(async () => null) });
    fetchImpl.mockResolvedValue(jsonResponse(401, { detail: 'Not authenticated' }));

    await expect(client.request('/x')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
