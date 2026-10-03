import * as ExpoCrypto from 'expo-crypto';

import { installCryptoPolyfills } from '../polyfills';

// jest.mock calls are hoisted above the imports by babel-jest.
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomValues: jest.fn((arr: Uint8Array) => {
    arr.fill(7);
    return arr;
  }),
  digest: jest.fn(async () => new Uint8Array([1, 2, 3]).buffer),
}));

describe('installCryptoPolyfills', () => {
  it('fills in getRandomValues and SHA-256 digest when missing', async () => {
    const target: { crypto?: any } = {};
    installCryptoPolyfills(target);

    const bytes = target.crypto.getRandomValues(new Uint8Array(4));
    expect(Array.from(bytes)).toEqual([7, 7, 7, 7]);

    const out = await target.crypto.subtle.digest('SHA-256', new Uint8Array([9]));
    expect(new Uint8Array(out)).toEqual(new Uint8Array([1, 2, 3]));
    expect(ExpoCrypto.digest).toHaveBeenCalledWith('SHA-256', new Uint8Array([9]));
  });

  it('rejects algorithms it cannot provide', async () => {
    const target: { crypto?: any } = {};
    installCryptoPolyfills(target);
    await expect(target.crypto.subtle.digest('SHA-1', new Uint8Array())).rejects.toThrow(/SHA-256/);
  });

  it('leaves native implementations untouched', () => {
    const getRandomValues = jest.fn();
    const digest = jest.fn();
    const target = { crypto: { getRandomValues, subtle: { digest } } };
    installCryptoPolyfills(target);
    expect(target.crypto.getRandomValues).toBe(getRandomValues);
    expect(target.crypto.subtle.digest).toBe(digest);
  });
});
