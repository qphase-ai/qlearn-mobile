import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import {
  DEFAULT_REMINDER,
  usePreferencesStore,
  whenPreferencesLoaded,
  type ReminderPreference,
} from '@/stores/preferences-store';

/**
 * Opt-in daily study reminder, as a local notification (no push token, no
 * server). The preference in the preferences store is the source of truth and
 * the OS schedule follows it. Only our own request (`REMINDER_ID`) is ever
 * scheduled or cancelled, so nothing else is clobbered.
 */

export const REMINDER_ID = 'qlearn.study-reminder';
export const REMINDER_CHANNEL_ID = 'study-reminders';
/** Tap target: Home, which leads with "Continue learning". */
export const REMINDER_URL = '/';

// Honest and generic: the client can't verify streaks or progress at fire time.
const REMINDER_CONTENT: Notifications.NotificationContentInput = {
  title: 'Q-Learn',
  body: 'Time for a little quantum practice.',
  data: { url: REMINDER_URL },
};

export type ReminderTime = Pick<ReminderPreference, 'hour' | 'minute'>;

/**
 * - `granted`: can schedule.
 * - `ask`: the OS prompt can still be shown (show the rationale first).
 * - `blocked`: only the system Settings can turn notifications back on.
 */
export type ReminderPermission = 'granted' | 'ask' | 'blocked';

function isAllowed(p: Notifications.NotificationPermissionsStatus): boolean {
  // iOS: `ios.status` is the precise value (provisional/ephemeral map to an
  // "undetermined" root status), per the expo-notifications docs.
  const ios = p.ios?.status;
  return (
    p.granted ||
    ios === Notifications.IosAuthorizationStatus.AUTHORIZED ||
    ios === Notifications.IosAuthorizationStatus.PROVISIONAL ||
    ios === Notifications.IosAuthorizationStatus.EPHEMERAL
  );
}

function toPermission(p: Notifications.NotificationPermissionsStatus): ReminderPermission {
  if (isAllowed(p)) return 'granted';
  return p.canAskAgain ? 'ask' : 'blocked';
}

export async function getReminderPermission(): Promise<ReminderPermission> {
  return toPermission(await Notifications.getPermissionsAsync());
}

/** kv content is untrusted: any malformed value reads as the default. */
export function readReminder(value: unknown): ReminderPreference {
  if (typeof value !== 'object' || value === null) return DEFAULT_REMINDER;
  const { enabled, hour, minute } = value as Partial<Record<keyof ReminderPreference, unknown>>;
  const valid = (n: unknown, max: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;
  const time =
    valid(hour, 23) && valid(minute, 59)
      ? { hour, minute }
      : { hour: DEFAULT_REMINDER.hour, minute: DEFAULT_REMINDER.minute };
  return { enabled: enabled === true, ...time };
}

/** Upper bound on waiting for the kv restore (it normally takes milliseconds). */
export const HYDRATION_TIMEOUT_MS = 2000;

/**
 * Zustand restores the store from kv asynchronously; writes before that would
 * be overwritten. Settles on success or failure of the restore, and never
 * waits longer than HYDRATION_TIMEOUT_MS.
 */
function whenHydrated(): Promise<void> {
  if (usePreferencesStore.persist.hasHydrated()) return Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, HYDRATION_TIMEOUT_MS);
  });
  return Promise.race([whenPreferencesLoaded(), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Operations run one at a time, in order. A foreground sync can fire while an
 * enable is waiting on the OS prompt (the app goes inactive and back), and
 * must not read the preference before the enable has written it.
 */
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

function current(): ReminderPreference {
  return readReminder(usePreferencesStore.getState().reminder);
}

function setPreference(reminder: ReminderPreference, blocked = false): void {
  const state = usePreferencesStore.getState();
  state.setReminder(reminder);
  state.setReminderBlocked(blocked);
}

async function ensureChannel(): Promise<void> {
  // Android 8+: notifications need a channel; on Android 13 the permission
  // prompt only appears once a channel exists. No-op on iOS.
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'Study reminders',
    description: 'The daily reminder you set in Profile.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function schedule(time: ReminderTime): Promise<void> {
  // Recreated each time: the student may have deleted it in system Settings.
  await ensureChannel();
  // Same identifier: replaces the existing request on both platforms.
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: REMINDER_CONTENT,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      channelId: REMINDER_CHANNEL_ID,
      hour: time.hour,
      minute: time.minute,
    },
  });
}

/** Permission gone: cancel, turn the preference off and show the Settings notice. */
async function turnOffBlocked({ hour, minute }: ReminderTime): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  setPreference({ enabled: false, hour, minute }, true);
}

/** The OS will not prompt again: show the Settings notice without scheduling. */
export function markReminderBlocked(): void {
  usePreferencesStore.getState().setReminderBlocked(true);
}

/**
 * Turn the reminder on at `time`. Asks for permission if the OS still can
 * (the caller shows the rationale first). Returns false, with the preference
 * left off and the Settings notice shown, when permission is not granted.
 */
export function enableReminder(time: ReminderTime): Promise<boolean> {
  return serial(async () => {
    await whenHydrated();
    const { hour, minute } = readReminder({ enabled: true, ...time });
    await ensureChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (!isAllowed(permission) && permission.canAskAgain) {
      // Alert and sound only: the reminder never sets a badge.
      permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
    }
    if (!isAllowed(permission)) {
      setPreference({ enabled: false, hour, minute }, true);
      return false;
    }
    await schedule({ hour, minute });
    setPreference({ enabled: true, hour, minute });
    return true;
  });
}

export function disableReminder(): Promise<void> {
  return serial(async () => {
    await whenHydrated();
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    setPreference({ ...current(), enabled: false });
  });
}

/**
 * Change the time. Reschedules when the reminder is on; never prompts. If
 * permission was revoked meanwhile, the reminder is turned off instead.
 */
export function setReminderTime(time: ReminderTime): Promise<void> {
  return serial(async () => {
    await whenHydrated();
    const { hour, minute } = readReminder({ enabled: true, ...time });
    if (!current().enabled) {
      usePreferencesStore.getState().setReminder({ enabled: false, hour, minute });
      return;
    }
    if (!isAllowed(await Notifications.getPermissionsAsync())) {
      await turnOffBlocked({ hour, minute });
      return;
    }
    await schedule({ hour, minute });
    setPreference({ enabled: true, hour, minute });
  });
}

/**
 * On launch and on return to the foreground (signed in): make the OS schedule
 * match the preference. A permission revoked in system Settings turns the
 * preference off and shows the Settings notice, so the card never shows a
 * reminder that can't fire.
 */
export function syncReminderSchedule(): Promise<void> {
  return serial(async () => {
    await whenHydrated();
    const reminder = current();
    if (!reminder.enabled) {
      await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
      // Back from Settings with notifications allowed: drop the notice.
      if (usePreferencesStore.getState().reminderBlocked && isAllowed(await Notifications.getPermissionsAsync())) {
        usePreferencesStore.getState().setReminderBlocked(false);
      }
      return;
    }
    if (!isAllowed(await Notifications.getPermissionsAsync())) {
      await turnOffBlocked(reminder);
      return;
    }
    await schedule(reminder);
    // Write back a repaired value if kv held a malformed one.
    const stored = usePreferencesStore.getState().reminder as Partial<ReminderPreference> | null;
    if (stored?.hour !== reminder.hour || stored?.minute !== reminder.minute) {
      usePreferencesStore.getState().setReminder(reminder);
    }
  });
}

/**
 * Sign-out: the reminder belongs to the account. The OS request is cancelled
 * first, without waiting for the store, so it stops even if kv is broken.
 */
export async function resetReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  await serial(async () => {
    await whenHydrated();
    // Again, in case an operation queued before the sign-out scheduled it.
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
    setPreference(DEFAULT_REMINDER);
  });
}

export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}

/**
 * Foreground presentation. A reminder that fires while the app is open has
 * done its job (the student is already here), so it is not shown: no banner,
 * no sound, nothing left in the tray. Anything else is shown normally.
 */
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const show = notification.request.identifier !== REMINDER_ID;
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: false, shouldSetBadge: false };
    },
  });
}
