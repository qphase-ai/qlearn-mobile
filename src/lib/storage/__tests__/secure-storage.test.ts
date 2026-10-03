import * as SecureStore from 'expo-secure-store';

import { CHUNK_SIZE, sanitizeKey, secureStorage } from '../secure-storage';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => store.clear());

describe('secureStorage', () => {
  it('round-trips a short value under the key itself', async () => {
    await secureStorage.setItem('sb-auth', 'hello');
    expect(store.get('sb-auth')).toBe('hello');
    await expect(secureStorage.getItem('sb-auth')).resolves.toBe('hello');
  });

  it('returns null for a missing key', async () => {
    await expect(secureStorage.getItem('missing')).resolves.toBeNull();
  });

  it('chunks values larger than the platform-safe size', async () => {
    const value = 'x'.repeat(CHUNK_SIZE * 2 + 10);
    await secureStorage.setItem('session', value);

    expect(store.get('session.__chunks')).toBe('3');
    expect(store.has('session')).toBe(false);
    for (const v of store.values()) expect(v.length).toBeLessThanOrEqual(CHUNK_SIZE);
    await expect(secureStorage.getItem('session')).resolves.toBe(value);
  });

  it('removes stale chunks when a value shrinks', async () => {
    await secureStorage.setItem('session', 'a'.repeat(CHUNK_SIZE * 3));
    await secureStorage.setItem('session', 'b'.repeat(CHUNK_SIZE + 1));
    expect(store.get('session.__chunks')).toBe('2');
    expect(store.has('session.2')).toBe(false);

    await secureStorage.setItem('session', 'short');
    expect([...store.keys()]).toEqual(['session']);
    await expect(secureStorage.getItem('session')).resolves.toBe('short');
  });

  it('treats a torn chunked write as absent', async () => {
    await secureStorage.setItem('session', 'z'.repeat(CHUNK_SIZE * 2));
    store.delete('session.1');
    await expect(secureStorage.getItem('session')).resolves.toBeNull();
  });

  it('removes every chunk', async () => {
    await secureStorage.setItem('session', 'q'.repeat(CHUNK_SIZE * 2));
    await secureStorage.removeItem('session');
    expect(store.size).toBe(0);
  });

  it('sanitizes keys SecureStore would reject', () => {
    expect(sanitizeKey('sb-ab:c/auth token')).toBe('sb-ab_c_auth_token');
    expect(sanitizeKey('valid.key-1_x')).toBe('valid.key-1_x');
  });
});
