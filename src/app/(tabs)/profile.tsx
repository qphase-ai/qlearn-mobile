import { useMutation } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';

import { ReminderCard } from '@/components/profile/ReminderCard';
import { ScreenTitle } from '@/components/ScreenTitle';
import { Banner, Button, Card, ErrorState, LoadingState, Screen, Text } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { signOut } from '@/features/auth/auth-api';
import { authErrorMessage } from '@/features/auth/errors';
import { getBuildInfo } from '@/features/profile/build-info';
import { ACCOUNT_OFFLINE, useMe } from '@/features/profile/hooks';
import { useTheme } from '@/hooks/use-theme';
import { isWaitingForNetwork } from '@/lib/query/online';
import { usePreferencesStore, type ThemePreference } from '@/stores/preferences-store';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  instructor: 'Instructor',
  admin: 'Admin',
};

// Fixed for the life of the process: a downloaded update applies on the next launch.
const BUILD = getBuildInfo();

export default function ProfileScreen() {
  const theme = useTheme();
  const me = useMe();
  const themePreference = usePreferencesStore((s) => s.themePreference);
  const setThemePreference = usePreferencesStore((s) => s.setThemePreference);
  const logout = useMutation({ mutationFn: signOut });

  return (
    <Screen>
      <ScreenTitle title="Profile" />

      <Card>
        <Text variant="heading">Account</Text>
        {me.isPending ? (
          isWaitingForNetwork(me) ? <Text color="muted">{ACCOUNT_OFFLINE}</Text> : <LoadingState />
        ) : me.isError ? (
          <ErrorState error={me.error} onRetry={() => void me.refetch()} retrying={me.isRefetching} />
        ) : (
          <View style={styles.rows}>
            <Row label="Email" value={me.data.email} />
            <Row label="Role" value={ROLE_LABEL[me.data.role] ?? me.data.role} />
            <Row label="Email verified" value={me.data.is_verified ? 'Yes' : 'Not yet'} />
          </View>
        )}
      </Card>

      <Card>
        <Text variant="heading">Appearance</Text>
        <View
          accessibilityRole="radiogroup"
          style={[styles.segmented, { backgroundColor: theme.overlay, borderColor: theme.border }]}>
          {THEME_OPTIONS.map((option) => {
            const selected = option.value === themePreference;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label} theme`}
                onPress={() => setThemePreference(option.value)}
                style={[styles.segment, selected && { backgroundColor: theme.surface }]}>
                <Text variant="label" color={selected ? 'foreground' : 'muted'}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <ReminderCard />

      <Card>
        <Text variant="heading">About</Text>
        <View style={styles.rows}>
          <Row label="Version" value={BUILD.version} />
          <Row label="Channel" value={BUILD.channel} />
          <Row label="Update" value={BUILD.update} />
        </View>
      </Card>

      {logout.error ? <Banner tone="error" message={authErrorMessage(logout.error)} /> : null}
      <Button
        label="Sign out"
        variant="secondary"
        onPress={() => logout.mutate()}
        loading={logout.isPending}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      <Text variant="label" style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg },
  value: { flexShrink: 1, textAlign: 'right' },
  segmented: {
    flexDirection: 'row',
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.xxs,
  },
  segment: {
    flex: 1,
    minHeight: MIN_TOUCH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.sm,
  },
});
