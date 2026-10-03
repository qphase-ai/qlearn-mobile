import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Monospace code with horizontal scrolling (lines never wrap). */
export function CodeView({
  code,
  language,
  filename,
}: {
  code: string;
  language?: string | null;
  filename?: string | null;
}) {
  const theme = useTheme();
  const label = filename || language;
  return (
    <View style={[styles.box, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
      {label ? (
        <Text variant="caption" color="muted" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text variant="mono" selectable>
          {code.replace(/\n$/, '')}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radii.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  label: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm },
  scroll: { padding: Spacing.md },
});
