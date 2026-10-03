import * as SecureStore from 'expo-secure-store';

/**
 * supabase-js storage adapter backed by the device keychain/keystore.
 *
 * A Supabase session (access + refresh token + user) is often larger than the
 * ~2 KB some iOS releases accept per SecureStore value, so long values are
 * split across `<key>.0 … <key>.n` with the chunk count stored at
 * `<key>.__chunks`. Short values are stored directly under the key.
 */

export const CHUNK_SIZE = 1800;

/** SecureStore keys may only contain alphanumerics, `.`, `-` and `_`. */
export function sanitizeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

const countKey = (key: string) => `${key}.__chunks`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function removeChunks(key: string, from = 0): Promise<void> {
  const count = await readCount(key);
  for (let i = from; i < count; i++) {
    await SecureStore.deleteItemAsync(chunkKey(key, i));
  }
  if (from === 0) await SecureStore.deleteItemAsync(countKey(key));
}

export const secureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = sanitizeKey(rawKey);
    const count = await readCount(key);
    if (count === 0) return SecureStore.getItemAsync(key);

    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      // A missing chunk means a torn write; treat the value as absent.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(rawKey: string, value: string): Promise<void> {
    const key = sanitizeKey(rawKey);
    if (value.length <= CHUNK_SIZE) {
      await removeChunks(key);
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const previous = await readCount(key);
    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        chunkKey(key, i),
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
      );
    }
    await SecureStore.setItemAsync(countKey(key), String(count));
    for (let i = count; i < previous; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
    await SecureStore.deleteItemAsync(key);
  },

  async removeItem(rawKey: string): Promise<void> {
    const key = sanitizeKey(rawKey);
    await removeChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};
