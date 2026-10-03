import { StyleSheet, View } from 'react-native';

import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './Text';

type Tone = 'info' | 'success' | 'error';

export function Banner({ tone = 'info', message }: { tone?: Tone; message: string }) {
  const theme = useTheme();
  const color = tone === 'error' ? theme.error : tone === 'success' ? theme.success : theme.primary;
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.banner, { borderColor: color, backgroundColor: theme.overlay }]}>
      <Text variant="label" style={{ color }}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    borderRadius: Radii.md,
    padding: Spacing.md,
  },
});
