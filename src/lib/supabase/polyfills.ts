import * as ExpoCrypto from 'expo-crypto';

/**
 * Fill the WebCrypto gaps supabase-js relies on for PKCE.
 *
 * Hermes has no `crypto.subtle`. Without SHA-256, supabase-js silently
 * downgrades the PKCE challenge to `plain`, which is weaker against a
 * redirect intercepted by another app claiming the `qlearn://` scheme.
 * Without `getRandomValues` the verifier falls back to Math.random. Both are
 * backed by expo-crypto here, and existing implementations are left alone.
 */
export function installCryptoPolyfills(target: { crypto?: unknown } = globalThis as never): void {
  const existing = (target.crypto ?? {}) as Record<string, unknown>;
  const cryptoObj: Record<string, unknown> = existing;

  if (typeof cryptoObj.getRandomValues !== 'function') {
    cryptoObj.getRandomValues = <T extends ArrayBufferView>(array: T): T =>
      ExpoCrypto.getRandomValues(array as never) as T;
  }

  const subtle = (cryptoObj.subtle ?? {}) as Record<string, unknown>;
  if (typeof subtle.digest !== 'function') {
    subtle.digest = async (algorithm: string | { name: string }, data: BufferSource) => {
      const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
      if (name.toUpperCase() !== 'SHA-256') {
        throw new Error(`crypto.subtle.digest polyfill only supports SHA-256, got ${name}`);
      }
      return ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, data);
    };
    cryptoObj.subtle = subtle;
  }

  if (target.crypto !== cryptoObj) {
    Object.defineProperty(target, 'crypto', { value: cryptoObj, configurable: true, writable: true });
  }
}
