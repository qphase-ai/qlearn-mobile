/**
 * The preferences store restores from kv asynchronously. These tests load a
 * fresh module graph whose kv read fails or never finishes, to check the
 * reminder never waits forever on it. The card's side is in
 * components/profile/__tests__/ReminderCard.broken-kv.test.tsx.
 */

type Modules = {
  kv: { getItem: jest.Mock; setItem: jest.Mock };
  N: { cancelScheduledNotificationAsync: jest.Mock; scheduleNotificationAsync: jest.Mock };
  reminders: typeof import('../reminders');
  store: typeof import('@/stores/preferences-store');
};

/** A cold start whose kv read of the preferences behaves like `getItem`. */
function coldStart(getItem: () => Promise<string | null>): Modules {
  jest.resetModules();
  const kv = jest.requireMock('expo-sqlite/kv-store').default;
  kv.getItem.mockImplementation(getItem);
  return {
    kv,
    N: jest.requireMock('expo-notifications'),
    reminders: jest.requireActual('../reminders'),
    store: jest.requireActual('@/stores/preferences-store'),
  };
}

afterEach(() => jest.useRealTimers());

describe('reminder with a broken preferences restore', () => {
  it.each([
    ['the kv read fails', () => Promise.reject(new Error('disk I/O'))],
    ['kv holds corrupt JSON', async () => '{not json'],
  ])('stays usable when %s', async (_case, getItem) => {
    const { N, reminders, store } = coldStart(getItem);

    expect(await reminders.enableReminder({ hour: 8, minute: 0 })).toBe(true);
    expect(N.scheduleNotificationAsync).toHaveBeenCalled();
    expect(store.usePreferencesStore.getState().reminder).toEqual({ enabled: true, hour: 8, minute: 0 });

    await reminders.resetReminder();
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(reminders.REMINDER_ID);
    expect(store.usePreferencesStore.getState().reminder).toEqual(store.DEFAULT_REMINDER);
  });

  it('cancels on sign-out at once, even if the restore never finishes', async () => {
    jest.useFakeTimers();
    const { N, reminders, store } = coldStart(() => new Promise(() => undefined));
    store.usePreferencesStore.setState({ reminder: { enabled: true, hour: 7, minute: 0 } });

    const reset = reminders.resetReminder();
    await Promise.resolve();
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(reminders.REMINDER_ID);

    // The preference is reset after a bounded wait.
    await jest.advanceTimersByTimeAsync(reminders.HYDRATION_TIMEOUT_MS);
    await reset;
    expect(store.usePreferencesStore.getState().reminder).toEqual(store.DEFAULT_REMINDER);
  });
});
