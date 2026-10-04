import * as Notifications from 'expo-notifications';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Linking } from 'react-native';

import { REMINDER_ID, syncReminderSchedule } from '@/features/notifications/reminders';
import { DEFAULT_REMINDER, usePreferencesStore } from '@/stores/preferences-store';

import { ReminderCard } from '../ReminderCard';

const N = jest.mocked(Notifications);

type Perm = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
const perm = (granted: boolean, canAskAgain = true): Perm =>
  ({ status: granted ? 'granted' : canAskAgain ? 'undetermined' : 'denied', granted, canAskAgain, expires: 'never' }) as Perm;

/** Answer the rationale alert with the given button. */
function answerRationale(text: 'Continue' | 'Not now') {
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.text === text)?.onPress?.();
  });
}

const toggle = () => screen.getByLabelText('Daily study reminder');

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  usePreferencesStore.setState({ reminder: DEFAULT_REMINDER, reminderBlocked: false });
  N.getPermissionsAsync.mockResolvedValue(perm(true));
  N.requestPermissionsAsync.mockResolvedValue(perm(true));
});

describe('ReminderCard', () => {
  it('turns on without a prompt when permission is already granted', async () => {
    await render(<ReminderCard />);
    await fireEvent(toggle(), 'valueChange', true);

    await waitFor(() => expect(screen.getByText('Every day at 19:00.')).toBeTruthy());
    expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: REMINDER_ID }));
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('explains before the OS prompt, and asks nothing on "Not now"', async () => {
    N.getPermissionsAsync.mockResolvedValue(perm(false));
    answerRationale('Not now');
    await render(<ReminderCard />);
    await fireEvent(toggle(), 'valueChange', true);

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(toggle().props.value).toBe(false);
  });

  it('keeps the toggle off and offers Settings when permission is denied', async () => {
    N.getPermissionsAsync.mockResolvedValue(perm(false));
    N.requestPermissionsAsync.mockResolvedValue(perm(false, false));
    answerRationale('Continue');
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await render(<ReminderCard />);
    await fireEvent(toggle(), 'valueChange', true);

    const settings = await screen.findByLabelText('Open Settings');
    expect(N.requestPermissionsAsync).toHaveBeenCalled();
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(toggle().props.value).toBe(false);
    await fireEvent.press(settings);
    expect(openSettings).toHaveBeenCalled();
  });

  it('goes straight to Settings when the OS will not prompt again', async () => {
    N.getPermissionsAsync.mockResolvedValue(perm(false, false));
    const alert = jest.spyOn(Alert, 'alert');
    await render(<ReminderCard />);
    await fireEvent(toggle(), 'valueChange', true);

    expect(await screen.findByLabelText('Open Settings')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
  });

  it('steps the time, wrapping around, and reschedules while on', async () => {
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 23, minute: 55 } });
    await render(<ReminderCard />);

    await fireEvent.press(screen.getByLabelText('Later hour'));
    await waitFor(() => expect(screen.getByText('Every day at 00:55.')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Later minutes'));
    await waitFor(() => expect(screen.getByText('Every day at 00:00.')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Earlier minutes'));
    await waitFor(() => expect(screen.getByText('Every day at 00:55.')).toBeTruthy());
    expect(N.scheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ hour: 0, minute: 55 }) })
    );
  });

  it('exposes each stepper as one adjustable control with its value', async () => {
    await render(<ReminderCard />);
    const hour = screen.getByLabelText('Reminder hour');
    expect(hour.props.accessibilityRole).toBe('adjustable');
    expect(hour.props.accessibilityValue).toEqual({ text: '19' });

    await fireEvent(hour, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await waitFor(() => expect(screen.getByLabelText('Reminder hour').props.accessibilityValue).toEqual({ text: '20' }));
    await fireEvent(screen.getByLabelText('Reminder minutes'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    await waitFor(() =>
      expect(screen.getByLabelText('Reminder minutes').props.accessibilityValue).toEqual({ text: '55' })
    );
  });

  it('shows the Settings notice when a sync found permission revoked', async () => {
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 19, minute: 0 } });
    N.getPermissionsAsync.mockResolvedValue(perm(false, false));
    await render(<ReminderCard />);
    await act(async () => syncReminderSchedule());

    expect(toggle().props.value).toBe(false);
    expect(screen.getByLabelText('Open Settings')).toBeTruthy();
  });

  it('turns off', async () => {
    usePreferencesStore.setState({ reminder: { enabled: true, hour: 19, minute: 0 } });
    await render(<ReminderCard />);
    await fireEvent(toggle(), 'valueChange', false);

    await waitFor(() => expect(toggle().props.value).toBe(false));
    expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
  });
});
