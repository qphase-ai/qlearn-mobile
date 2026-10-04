import Storage from 'expo-sqlite/kv-store';
import { router, type Href } from 'expo-router';

import { protectedHref } from './links';

/**
 * "Pending href": a signed-in-only link opened while signed out. The guard in
 * app/_layout.tsx sends the student to login and drops the target, so it is
 * remembered here (memory, plus kv for a cold start) and replayed once after
 * sign-in by `usePendingHrefReplay`. One entry, newest wins, 15 minute expiry.
 */

export const PENDING_HREF_KEY = 'qlearn.pending-href';
export const PENDING_HREF_TTL_MS = 15 * 60_000;

interface Pending {
  href: string;
  savedAt: number;
}

type AuthState = 'unknown' | 'signed-in' | 'signed-out';

let authState: AuthState = 'unknown';
/** In-memory copy; `undefined` until kv has been read or written this launch. */
let pending: Pending | null | undefined;
/** A system link that arrived before the session was read. The router opens it itself. */
let launchLink: string | null = null;

function save(href: string): void {
  // Home is where sign-in lands anyway, and a plain app launch arrives as the
  // root URL too: it must not replace a link that is waiting.
  if (href === '/') return;
  pending = { href, savedAt: Date.now() };
  void Storage.setItem(PENDING_HREF_KEY, JSON.stringify(pending)).catch(() => undefined);
}

export function clearPendingHref(): void {
  pending = null;
  launchLink = null;
  void Storage.removeItem(PENDING_HREF_KEY).catch(() => undefined);
}

async function read(): Promise<Pending | null> {
  if (pending !== undefined) return pending;
  try {
    const raw = await Storage.getItem(PENDING_HREF_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Pending>) : null;
    // Re-validate: kv content is untrusted too.
    const href = typeof parsed?.href === 'string' ? protectedHref(parsed.href) : null;
    return href && typeof parsed?.savedAt === 'number' ? { href, savedAt: parsed.savedAt } : null;
  } catch {
    return null;
  }
}

/** The pending href if it hasn't expired. Clears it either way (replayed once). */
export async function takePendingHref(now = Date.now()): Promise<string | null> {
  const entry = await read();
  clearPendingHref();
  const fresh = entry && entry.savedAt <= now && now - entry.savedAt <= PENDING_HREF_TTL_MS;
  return fresh ? entry.href : null;
}

/**
 * Called from `+native-intent` for every system link, before the router opens
 * it. Remembers supported signed-in links while signed out; the path itself is
 * never rewritten.
 */
export function captureSystemLink(path: string): void {
  const href = protectedHref(path);
  // Home: see save(). As a launch link it would also beat a waiting href.
  if (!href || href === '/') return;
  if (authState === 'signed-out') save(href);
  else if (authState === 'unknown') launchLink = href;
}

/**
 * Open an app link from inside the app (e.g. a notification tap). Only
 * supported links are opened: signed in it navigates now, otherwise it is
 * replayed after sign-in.
 */
export function openAppLink(input: string): void {
  const href = protectedHref(input);
  if (!href) return;
  if (authState === 'signed-in') router.navigate(href as Href);
  else save(href);
}

/** The root navigator reports the resolved auth state (see usePendingHrefReplay). */
export function setLinkAuthState(signedIn: boolean): void {
  if (authState === 'unknown' && launchLink) {
    // Signed in, the router already opened the launch link, and it beats any
    // older pending href. Signed out, it becomes the pending href.
    if (signedIn) clearPendingHref();
    else save(launchLink);
  }
  launchLink = null;
  authState = signedIn ? 'signed-in' : 'signed-out';
}

/** Test-only: forget everything held in memory (simulates a cold start). */
export function resetPendingHrefForTests(): void {
  authState = 'unknown';
  pending = undefined;
  launchLink = null;
}
