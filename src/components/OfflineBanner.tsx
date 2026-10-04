import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useIsOnline } from '@/lib/query/online';

/**
 * Sits above the signed-in stack while the device is offline. It takes the
 * status-bar inset itself; the screens' SafeAreaViews below then measure no
 * top inset, so nothing is padded twice.
 */
export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  if (online) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { paddingTop: insets.top + Spacing.xs, backgroundColor: theme.surface, borderBottomColor: theme.warning },
      ]}>
      <Ionicons name="cloud-offline-outline" size={16} color={theme.warning} />
      <Text variant="caption" color="foreground">
        You&apos;re offline. Showing saved content.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
