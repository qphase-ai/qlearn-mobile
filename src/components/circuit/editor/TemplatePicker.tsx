import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { TEMPLATES } from '@/features/circuit/editor/templates';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { IconButton } from './IconButton';

/**
 * Example circuits to start from. Shown on an empty canvas, and from the
 * toolbar (then `onClose` hides it again). Loading replaces the current
 * circuit; undo brings it back.
 */
export function TemplatePicker({ onClose }: { onClose?: () => void }) {
  const theme = useTheme();
  const loadTemplate = useCircuitEditorStore((s) => s.loadTemplate);
  const hasGates = useCircuitEditorStore((s) => s.gates.length > 0);

  const load = (id: string) => {
    const result = loadTemplate(id);
    if (!result.ok) {
      Alert.alert("Couldn't open the example", result.error);
      return;
    }
    onClose?.();
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.title}>
          <Text variant="heading">{hasGates ? 'Start from an example' : 'Start with an example'}</Text>
          <Text variant="caption" color="muted">
            {hasGates
              ? 'This replaces your circuit. You can undo it.'
              : 'Or pick a gate above and tap a wire to build your own.'}
          </Text>
        </View>
        {onClose ? <IconButton icon="close" label="Hide examples" onPress={onClose} /> : null}
      </View>
      {TEMPLATES.map((t) => (
        <Pressable
          key={t.id}
          accessibilityRole="button"
          accessibilityLabel={`${t.title} example`}
          accessibilityHint={t.description}
          onPress={() => load(t.id)}
          style={({ pressed }) => [
            styles.card,
            { borderColor: theme.border, backgroundColor: pressed ? theme.overlay : theme.surface },
          ]}>
          <View style={styles.cardText}>
            <Text variant="label">{t.title}</Text>
            <Text variant="caption" color="muted">
              {t.description}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.muted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { flex: 1, gap: Spacing.xxs },
  card: {
    minHeight: MIN_TOUCH + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardText: { flex: 1, gap: Spacing.xxs },
});
