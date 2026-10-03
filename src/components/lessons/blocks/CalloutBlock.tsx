import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radii, Spacing, type ThemeColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Markdown } from '../markdown/Markdown';

import type { BlockProps } from './types';

const VARIANTS: Record<
  BlockProps<'callout'>['variant'],
  { color: keyof ThemeColors; icon: React.ComponentProps<typeof Ionicons>['name']; label: string }
> = {
  info: { color: 'primary', icon: 'information-circle-outline', label: 'Note' },
  tip: { color: 'success', icon: 'bulb-outline', label: 'Tip' },
  warning: { color: 'warning', icon: 'warning-outline', label: 'Warning' },
  important: { color: 'accent', icon: 'alert-circle-outline', label: 'Important' },
};

export function CalloutBlock({ variant, title, body }: BlockProps<'callout'>) {
  const theme = useTheme();
  const v = VARIANTS[variant] ?? VARIANTS.info;
  const color = theme[v.color];
  return (
    <View
      accessibilityRole="summary"
      style={[styles.box, { borderLeftColor: color, backgroundColor: theme.overlay }]}>
      <View style={styles.header}>
        <Ionicons name={v.icon} size={18} color={color} />
        <Text variant="label" style={[styles.title, { color }]}>
          {title || v.label}
        </Text>
      </View>
      <Markdown source={body} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderLeftWidth: 3, borderRadius: Radii.md, padding: Spacing.md, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  title: { fontWeight: '700' },
});
