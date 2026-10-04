import Storage from 'expo-sqlite/kv-store';
import { router } from 'expo-router';

import {
  captureSystemLink,
  clearPendingHref,
  openAppLink,
  PENDING_HREF_KEY,
  PENDING_HREF_TTL_MS,
  resetPendingHrefForTests,
  setLinkAuthState,
  takePendingHref,
} from '../pending-href';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), replace: jest.fn() } }));

const LESSON = '/lesson/0b6f1f6e-1111-4c1e-9f00-000000000001';

beforeEach(async () => {
  jest.clearAllMocks();
  resetPendingHrefForTests();
  await Storage.removeItem(PENDING_HREF_KEY);
});

describe('pending href', () => {
  it('remembers a protected link opened while signed out, once', async () => {
    setLinkAuthState(false);
    captureSystemLink(`qlearn:/${LESSON}`);
    expect(await takePendingHref()).toBe(LESSON);
    expect(await takePendingHref()).toBeNull();
  });

  it('keeps one entry, newest wins, and a plain launch does not replace it', async () => {
    setLinkAuthState(false);
    captureSystemLink('qlearn://learn');
    captureSystemLink(`qlearn:/${LESSON}`);
    captureSystemLink('qlearn://');
    expect(await takePendingHref()).toBe(LESSON);
  });

  it('expires after 15 minutes', async () => {
    setLinkAuthState(false);
    captureSystemLink('qlearn://learn');
    expect(await takePendingHref(Date.now() + PENDING_HREF_TTL_MS + 1)).toBeNull();
  });

  it('treats an entry saved in the future as expired', async () => {
    await Storage.setItem(PENDING_HREF_KEY, JSON.stringify({ href: '/learn', savedAt: Date.now() + 60_000 }));
    expect(await takePendingHref()).toBeNull();
  });

  it('keeps a waiting href through a signed-in plain launch', async () => {
    await Storage.setItem(PENDING_HREF_KEY, JSON.stringify({ href: '/learn', savedAt: Date.now() }));
    captureSystemLink('qlearn://'); // a plain launch arrives as the root URL
    setLinkAuthState(true);
    expect(await takePendingHref()).toBe('/learn');
  });

  it('survives a cold start through kv', async () => {
    setLinkAuthState(false);
    captureSystemLink('qlearn://profile');
    await Promise.resolve();
    resetPendingHrefForTests();
    expect(await takePendingHref()).toBe('/profile');
  });

  it('re-validates what it reads from kv', async () => {
    await Storage.setItem(PENDING_HREF_KEY, JSON.stringify({ href: '/reset-password', savedAt: Date.now() }));
    expect(await takePendingHref()).toBeNull();
  });

  it.each(['qlearn://auth/callback?code=x', 'qlearn://reset-password?code=x', 'qlearn://quiz/1', 'qlearn://lesson/bad'])(
    'never stores %s',
    async (url) => {
      setLinkAuthState(false);
      captureSystemLink(url);
      openAppLink(url);
      expect(await takePendingHref()).toBeNull();
      expect(await Storage.getItem(PENDING_HREF_KEY)).toBeNull();
    }
  );

  it('ignores system links while signed in: the router opens them', async () => {
    setLinkAuthState(true);
    captureSystemLink(`qlearn:/${LESSON}`);
    expect(await takePendingHref()).toBeNull();
  });

  it('holds a launch link until the session is read', async () => {
    captureSystemLink(`qlearn:/${LESSON}`);
    setLinkAuthState(false);
    expect(await takePendingHref()).toBe(LESSON);

    resetPendingHrefForTests();
    setLinkAuthState(false);
    captureSystemLink('qlearn://learn'); // an older pending href…
    resetPendingHrefForTests();
    captureSystemLink(`qlearn:/${LESSON}`);
    setLinkAuthState(true); // …loses to a launch link the router already opened
    expect(await takePendingHref()).toBeNull();
  });

  it('openAppLink navigates when signed in and waits for sign-in otherwise', async () => {
    openAppLink('/learn');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(await takePendingHref()).toBe('/learn');

    setLinkAuthState(true);
    openAppLink(`qlearn:/${LESSON}`);
    expect(router.navigate).toHaveBeenCalledWith(LESSON);
  });

  it('openAppLink ignores unsupported links, signed in too', () => {
    setLinkAuthState(true);
    ['qlearn://quiz/1', 'qlearn://lesson/bad', 'qlearn://reset-password?code=x', 'https://x.test/learn'].forEach(
      openAppLink
    );
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clearPendingHref forgets memory and kv', async () => {
    setLinkAuthState(false);
    captureSystemLink('qlearn://learn');
    clearPendingHref();
    resetPendingHrefForTests();
    expect(await takePendingHref()).toBeNull();
  });
});
