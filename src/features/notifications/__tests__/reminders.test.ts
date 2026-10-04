import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { DEFAULT_REMINDER, usePreferencesStore } from '@/stores/preferences-store';

import {
  disableReminder,
  enableReminder,
  getReminderPermission,
  openNotificationSettings,
  readReminder,
  REMINDER_CHANNEL_ID,
  REMINDER_ID,
  resetReminder,
  setReminderTime,
  setupNotificationHandler,
  syncReminderSchedule,
} from '../reminders';

const N = jest.mocked(Notifications);

type Perm = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
const perm = (granted: boolean, canAskAgain = true): Perm =>
  ({ status: granted ? 'granted' : canAskAgain ? 'undetermined' : 'denied', granted, canAskAgain, expires: 'never' }) as Perm;

const reminder = () => usePreferencesStore.getState().reminder;

beforeEach(() => {
  jest.clearAllMocks();
  usePreferencesStore.setState({ reminder: DEFAULT_REMINDER, reminderBlocked: false });
  N.getPermissionsAsync.mockResolvedValue(perm(true));
  N.requestPermissionsAsync.mockResolvedValue(perm(true));
});

afterEach(() => jest.restoreAllMocks());

describe('study reminder', () => {
  it('defaults to off at 19:00', () => {
    expect(DEFAULT_REMINDER).toEqual({ enabled: false, hour: 19, minute: 0 });
  });

  it('reads malformed preferences as the default', () => {
    expect(readReminder(null)).toEqual(DEFAULT_REMINDER);
    expect(readReminder('x')).toEqual(DEFAULT_REMINDER);
    expect(readReminder({ enabled: true, hour: '7', minute: 0 })).toEqual({ enabled: true, hour: 19, minute: 0 });
    expect(readReminder({ enabled: 1, hour: 7, minute: 30 })).toEqual({ enabled: false, hour: 7, minute: 30 });
  });

  it('schedules one daily reminder under a fixed id (which replaces the previous one)', async () => {
    expect(await enableReminder({ hour: 8, minute: 30 })).toBe(true);

    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: REMINDER_ID,
      content: { title: 'Q-Learn', body: 'Time for a little quantum practice.', data: { url: '/' } },
      trigger: { type: 'daily', channelId: REMINDER_CHANNEL_ID, hour: 8, minute: 30 },
    });
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(reminder()).toEqual({ enabled: true, hour: 8, minute: 30 });
  });

  it('creates the Android channel before asking for permission', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    N.getPermissionsAsync.mockResolvedValue(perm(false));
    await enableReminder({ hour: 19, minute: 0 });

    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(
      REMINDER_CHANNEL_ID,
      expect.objectContaining({ name: 'Study reminders' })
    );
    expect(N.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      N.requestPermissionsAsync.mock.invocationCallOrder[0]
    );
    // Alert and sound only, no badge.
    expect(N.requestPermissionsAsync).toHaveBeenCalledWith({ ios: { allowAlert: true, allowSound: true } });
  });

  it('recreates the Android channel when the time changes', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 9, minute: 0 } });
    await setReminderTime({ hour: 9, minute: 5 });
    expect(N.setNotificationChannelAsync).toHaveBeenCalledWith(REMINDER_CHANNEL_ID, expect.anything());
    expect(N.setNotificationChannelAsync.mock.invocationCallOrder[0]).toBeLessThan(
      N.scheduleNotificationAsync.mock.invocationCallOrder[0]
    );
  });

  it('skips the channel on iOS', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await enableReminder({ hour: 9, minute: 0 });
    expect(N.setNotificationChannelAsync).not.toHaveBeenCalled();
  });

  it('keeps the reminder off when permission is denied', async () => {
    N.getPermissionsAsync.mockResolvedValue(perm(false));
    N.requestPermissionsAsync.mockResolvedValue(perm(false, false));

    expect(await enableReminder({ hour: 7, minute: 0 })).toBe(false);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(reminder()).toEqual({ enabled: false, hour: 7, minute: 0 });
    expect(usePreferencesStore.getState().reminderBlocked).toBe(true);
  });

  it('does not prompt again once the OS has blocked it', async () => {
    N.getPermissionsAsync.mockResolvedValue(perm(false, false));
    expect(await getReminderPermission()).toBe('blocked');
    expect(await enableReminder({ hour: 7, minute: 0 })).toBe(false);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports provisional iOS authorization as granted', async () => {
    N.getPermissionsAsync.mockResolvedValue({
      ...perm(false),
      ios: { status: Notifications.IosAuthorizationStatus.PROVISIONAL },
    } as Perm);
    expect(await getReminderPermission()).toBe('granted');
  });

  it('opens the system Settings', async () => {
    const spy = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await openNotificationSettings();
    expect(spy).toHaveBeenCalled();
  });

  it('disables: cancels only its own request and keeps the time', async () => {
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 6, minute: 45 } });
    await disableReminder();
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
    expect(reminder()).toEqual({ enabled: false, hour: 6, minute: 45 });
  });

  it('reschedules a time change only while on', async () => {
    await setReminderTime({ hour: 9, minute: 5 });
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(reminder()).toEqual({ enabled: false, hour: 9, minute: 5 });

    usePreferencesStore.setState({ reminder: { enabled: true, hour: 9, minute: 5 } });
    await setReminderTime({ hour: 10, minute: 5 });
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ hour: 10, minute: 5 }) })
    );
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  describe('launch sync', () => {
    it('reschedules an enabled reminder', async () => {
      usePreferencesStore.setState({ reminder: { enabled: true, hour: 20, minute: 15 } });
      await syncReminderSchedule();
      expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: REMINDER_ID, trigger: expect.objectContaining({ hour: 20, minute: 15 }) })
      );
    });

    it('cancels a leftover schedule when the reminder is off', async () => {
      await syncReminderSchedule();
      expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
      expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('turns the preference off when permission was revoked in Settings', async () => {
      usePreferencesStore.setState({ reminder: { enabled: true, hour: 20, minute: 15 } });
      N.getPermissionsAsync.mockResolvedValue(perm(false, false));
      await syncReminderSchedule();
      expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
      expect(reminder()).toEqual({ enabled: false, hour: 20, minute: 15 });
      expect(usePreferencesStore.getState().reminderBlocked).toBe(true);
    });

    it('drops the Settings notice once notifications are allowed again', async () => {
      usePreferencesStore.setState({ reminderBlocked: true });
      await syncReminderSchedule();
      expect(usePreferencesStore.getState().reminderBlocked).toBe(false);
      expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it.each([null, 'on', 42, { enabled: 'yes', hour: 8, minute: 0 }])(
      'treats the malformed stored value %p as off',
      async (stored) => {
        usePreferencesStore.setState({ reminder: stored as never });
        await syncReminderSchedule();
        expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
        expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
      }
    );

    it('does not cancel an enable that is waiting on the OS prompt', async () => {
      N.getPermissionsAsync.mockResolvedValue(perm(false));
      let answer: (p: Perm) => void = () => undefined;
      N.requestPermissionsAsync.mockReturnValue(new Promise<Perm>((resolve) => (answer = resolve)));
      const enabling = enableReminder({ hour: 8, minute: 0 });
      // The prompt sends the app inactive; coming back triggers a sync.
      const syncing = syncReminderSchedule();
      await Promise.resolve();
      N.getPermissionsAsync.mockResolvedValue(perm(true));
      answer(perm(true));
      await Promise.all([enabling, syncing]);

      expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
      expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
      expect(reminder()).toEqual({ enabled: true, hour: 8, minute: 0 });
    });

    it('repairs an out-of-range stored time', async () => {
      usePreferencesStore.setState({ reminder: { enabled: true, hour: 31, minute: -2 } });
      await syncReminderSchedule();
      expect(reminder()).toEqual({ enabled: true, hour: 19, minute: 0 });
    });
  });

  it('sign-out reset cancels the reminder and restores the default', async () => {
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 6, minute: 0 }, reminderBlocked: true });
    await resetReminder();
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
    expect(reminder()).toEqual(DEFAULT_REMINDER);
    expect(usePreferencesStore.getState().reminderBlocked).toBe(false);
  });

  it('does not show a reminder that fires while the app is open', async () => {
    setupNotificationHandler();
    const { handleNotification } = N.setNotificationHandler.mock.calls[0][0]!;
    const notification = (identifier: string) =>
      ({ date: 0, request: { identifier, content: {}, trigger: null } }) as unknown as Notifications.Notification;

    expect(await handleNotification(notification(REMINDER_ID))).toMatchObject({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
    });
    expect(await handleNotification(notification('other'))).toMatchObject({ shouldShowBanner: true });
  });
});
