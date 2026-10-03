import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Card({ style, children, ...rest }: PropsWithChildren<ViewProps>) {
  const theme = useTheme();
  return (
    <View
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
});
