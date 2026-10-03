import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Text } from './ui/Text';

/**
 * Shown instead of the app when required EXPO_PUBLIC_* config is missing.
 * Developer-facing, because a correctly built binary never reaches it.
 */
export function ConfigErrorScreen({ message }: { message: string }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text variant="title">Configuration error</Text>
      <Text variant="body" color="muted" style={styles.center}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.md },
  center: { textAlign: 'center' },
});
