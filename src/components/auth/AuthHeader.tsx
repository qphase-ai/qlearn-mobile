import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

export function AuthHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.header}>
      <Text variant="caption" color="primary" style={styles.brand}>
        Q-LEARN
      </Text>
      <Text variant="display" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text variant="body" color="muted">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  brand: { letterSpacing: 2, fontWeight: '700' },
});
