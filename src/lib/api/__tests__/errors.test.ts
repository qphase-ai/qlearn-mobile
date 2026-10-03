import { ApiError, errorFromResponse, toUserMessage } from '../errors';

describe('errorFromResponse', () => {
  it('falls back to a status-derived code', () => {
    expect(errorFromResponse(403, null).code).toBe('FORBIDDEN');
    expect(errorFromResponse(500, {}).code).toBe('INTERNAL_ERROR');
  });
});

describe('ApiError.isRetryable', () => {
  it('retries only transient failures', () => {
    expect(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '' }).isRetryable).toBe(true);
    expect(new ApiError({ status: 503, code: 'INTERNAL_ERROR', message: '' }).isRetryable).toBe(true);
    expect(new ApiError({ status: 404, code: 'NOT_FOUND', message: '' }).isRetryable).toBe(false);
    expect(new ApiError({ status: 401, code: 'UNAUTHORIZED', message: '' }).isRetryable).toBe(false);
  });
});

describe('toUserMessage', () => {
  it('never leaks server detail for 5xx errors', () => {
    const err = new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'psycopg.OperationalError at /srv/app/db.py:42',
    });
    expect(toUserMessage(err)).not.toMatch(/psycopg|srv/);
  });

  it('explains offline and timeout states', () => {
    expect(toUserMessage(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '' }))).toMatch(/offline/i);
    expect(toUserMessage(new ApiError({ status: 0, code: 'TIMEOUT', message: '' }))).toMatch(/too long/i);
  });

  it('passes through client-side validation messages', () => {
    const err = new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Circuit validation failed' });
    expect(toUserMessage(err)).toBe('Circuit validation failed');
  });

  it('handles non-API errors', () => {
    expect(toUserMessage(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });
});
