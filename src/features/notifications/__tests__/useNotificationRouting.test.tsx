import Storage from 'expo-sqlite/kv-store';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { act, renderHook } from '@testing-library/react-native';

import {
  PENDING_HREF_KEY,
  resetPendingHrefForTests,
  setLinkAuthState,
  takePendingHref,
} from '@/features/linking/pending-href';

import { resetNotificationRoutingForTests, useNotificationRouting } from '../useNotificationRouting';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), replace: jest.fn() } }));

const N = jest.mocked(Notifications);
const respond = (response: unknown) =>
  (jest.requireMock('expo-notifications') as { __respond: (r: unknown) => void }).__respond(response);

const LESSON = '/lesson/0b6f1f6e-1111-4c1e-9f00-000000000001';

function tap(url: unknown, { date = 1, action = Notifications.DEFAULT_ACTION_IDENTIFIER } = {}) {
  return {
    actionIdentifier: action,
    notification: { date, request: { identifier: 'qlearn.study-reminder', content: { data: { url } }, trigger: null } },
  } as unknown as Notifications.NotificationResponse;
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetPendingHrefForTests();
  resetNotificationRoutingForTests();
  N.getLastNotificationResponse.mockReturnValue(null);
  await Storage.removeItem(PENDING_HREF_KEY);
});

describe('notification tap routing', () => {
  it('opens Home on a tap while running and signed in', async () => {
    setLinkAuthState(true);
    const { unmount } = await renderHook(() => useNotificationRouting());

    await act(async () => respond(tap('/')));
    expect(router.navigate).toHaveBeenCalledWith('/');
    expect(N.clearLastNotificationResponse).toHaveBeenCalled();

    await unmount();
    await act(async () => respond(tap('/', { date: 2 })));
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('routes the cold-start tap once, even if the listener also reports it', async () => {
    setLinkAuthState(true);
    N.getLastNotificationResponse.mockReturnValue(tap(LESSON));
    await renderHook(() => useNotificationRouting());
    await act(async () => respond(tap(LESSON)));

    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(LESSON);
    expect(N.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it('does not route a stale last response again after a remount', async () => {
    setLinkAuthState(true);
    N.getLastNotificationResponse.mockReturnValue(tap(LESSON));
    const first = await renderHook(() => useNotificationRouting());
    await first.unmount();
    await renderHook(() => useNotificationRouting());
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('keeps a signed-out tap for after sign-in', async () => {
    setLinkAuthState(false);
    await renderHook(() => useNotificationRouting());
    await act(async () => respond(tap(LESSON)));

    expect(router.navigate).not.toHaveBeenCalled();
    expect(await takePendingHref()).toBe(LESSON);
  });

  it('ignores unsupported links and non-default actions', async () => {
    setLinkAuthState(true);
    await renderHook(() => useNotificationRouting());
    await act(async () => respond(tap('/circuit/abc')));
    await act(async () => respond(tap(42, { date: 3 })));
    await act(async () => respond(tap('/', { date: 4, action: 'dismiss' })));
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
