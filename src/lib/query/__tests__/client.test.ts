import { ApiError } from '@/lib/api/errors';

import { shouldRetry } from '../client';

describe('shouldRetry', () => {
  const network = new ApiError({ status: 0, code: 'NETWORK_ERROR', message: '' });
  const notFound = new ApiError({ status: 404, code: 'NOT_FOUND', message: '' });

  it('retries transient errors up to the limit', () => {
    expect(shouldRetry(0, network)).toBe(true);
    expect(shouldRetry(1, network)).toBe(true);
    expect(shouldRetry(2, network)).toBe(false);
  });

  it('does not retry client errors or unknown errors', () => {
    expect(shouldRetry(0, notFound)).toBe(false);
    expect(shouldRetry(0, new Error('x'))).toBe(false);
  });
});
