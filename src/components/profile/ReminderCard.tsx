import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { Banner, Button, Card, Text } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import {
  disableReminder,
  enableReminder,
  getReminderPermission,
  markReminderBlocked,
  openNotificationSettings,
  readReminder,
  setReminderTime,
  type ReminderTime,
} from '@/features/notifications/reminders';
import { useTheme } from '@/hooks/use-theme';
import { usePreferencesStore } from '@/stores/preferences-store';

const MINUTE_STEP = 5;
const pad = (n: number) => String(n).padStart(2, '0');
export const formatReminderTime = ({ hour, minute }: ReminderTime) => `${pad(hour)}:${pad(minute)}`;

/** Shown before the OS prompt, which can only be answered once. */
function confirmRationale(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Allow notifications?',
      'Q-Learn uses notifications only for the daily reminder you set here. You can turn it off at any time.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Continue', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/** Profile card: opt-in daily study reminder (a local notification). */
export function ReminderCard() {
  const theme = useTheme();
  // kv content is untrusted: read it through readReminder (never crashes on a malformed value).
  const reminder = readReminder(usePreferencesStore((s) => s.reminder));
  const blocked = usePreferencesStore((s) => s.reminderBlocked);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setFailed(false);
    try {
      await task();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const onToggle = (on: boolean) =>
    run(async () => {
      if (!on) {
        await disableReminder();
        return;
      }
      const permission = await getReminderPermission();
      if (permission === 'blocked') {
        markReminderBlocked();
        return;
      }
      if (permission === 'ask' && !(await confirmRationale())) return;
      await enableReminder(reminder);
    });

  const shift = (unit: 'hour' | 'minute', direction: 1 | -1) => {
    const hour = unit === 'hour' ? (reminder.hour + direction + 24) % 24 : reminder.hour;
    const minute =
      unit === 'minute' ? (reminder.minute + direction * MINUTE_STEP + 60) % 60 : reminder.minute;
    void run(() => setReminderTime({ hour, minute }));
  };

  const time = formatReminderTime(reminder);

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="heading">Study reminder</Text>
          <Text variant="caption" color="muted">
            A daily notification on this device.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Daily study reminder"
          value={reminder.enabled}
          disabled={busy}
          onValueChange={(on) => void onToggle(on)}
          trackColor={{ false: theme.border, true: theme.primary }}
          thumbColor={theme.surface}
          ios_backgroundColor={theme.border}
        />
      </View>

      <View style={styles.timeRow}>
        <Text variant="label" color="muted">
          Time
        </Text>
        <View style={styles.steppers}>
          <Stepper unit="hour" value={pad(reminder.hour)} disabled={busy} onShift={shift} />
          <Text variant="heading" accessibilityElementsHidden importantForAccessibility="no">
            :
          </Text>
          <Stepper unit="minute" value={pad(reminder.minute)} disabled={busy} onShift={shift} />
        </View>
      </View>
      <Text variant="caption" color="muted">
        {reminder.enabled ? `Every day at ${time}.` : `Off. Turn it on to get a reminder at ${time}.`}
      </Text>

      {blocked ? (
        <View style={styles.blocked}>
          <Banner message="Notifications are off for Q-Learn. Turn them on in Settings to get the reminder." />
          <Button label="Open Settings" variant="secondary" onPress={() => void openNotificationSettings()} />
        </View>
      ) : null}
      {failed ? <Banner tone="error" message="Couldn't update the reminder. Try again." /> : null}
    </Card>
  );
}

/**
 * One "adjustable" element for screen readers (swipe up/down, announced with
 * its value); the − and + buttons are for touch.
 */
function Stepper({
  unit,
  value,
  disabled,
  onShift,
}: {
  unit: 'hour' | 'minute';
  value: string;
  disabled: boolean;
  onShift: (unit: 'hour' | 'minute', direction: 1 | -1) => void;
}) {
  const theme = useTheme();
  const noun = unit === 'hour' ? 'hour' : 'minutes';
  const step = (direction: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${direction < 0 ? 'Earlier' : 'Later'} ${noun}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => onShift(unit, direction)}
      style={styles.stepButton}>
      <Text variant="heading" color={disabled ? 'muted' : 'foreground'}>
        {direction < 0 ? '−' : '+'}
      </Text>
    </Pressable>
  );
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={unit === 'hour' ? 'Reminder hour' : 'Reminder minutes'}
      accessibilityValue={{ text: value }}
      accessibilityState={{ disabled }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (disabled) return;
        if (event.nativeEvent.actionName === 'increment') onShift(unit, 1);
        if (event.nativeEvent.actionName === 'decrement') onShift(unit, -1);
      }}
      style={[styles.stepper, { borderColor: theme.border, backgroundColor: theme.overlay }]}>
      {step(-1)}
      <Text
        variant="mono"
        style={styles.value}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {value}
      </Text>
      {step(1)}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xxs },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  steppers: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stepButton: { minWidth: MIN_TOUCH, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 28, textAlign: 'center' },
  blocked: { gap: Spacing.sm },
});
