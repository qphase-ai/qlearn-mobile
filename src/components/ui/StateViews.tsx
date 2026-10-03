import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';

import { Button } from './Button';
import { Text } from './Text';

/** Shared loading / error / empty states: every network view uses these. */

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={theme.primary} />
      <Text variant="label" color="muted">
        {label}
      </Text>
    </View>
  );
}

export function ErrorState({
  error,
  onRetry,
  retrying = false,
}: {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={styles.center} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={28} color={theme.muted} />
      <Text variant="body" color="muted" style={styles.message}>
        {toUserMessage(error)}
      </Text>
      {onRetry ? (
        <Button label="Try again" variant="secondary" onPress={onRetry} loading={retrying} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
}: {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={32} color={theme.primary} />
      <Text variant="heading" style={styles.message}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="muted" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  message: { textAlign: 'center' },
});
