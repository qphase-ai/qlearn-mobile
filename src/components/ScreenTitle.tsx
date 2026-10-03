import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';

import { Text } from './ui/Text';

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
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

const styles = StyleSheet.create({ wrap: { gap: Spacing.xs, marginTop: Spacing.sm } });
