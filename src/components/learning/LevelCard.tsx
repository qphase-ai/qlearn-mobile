import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { completionCaption } from '@/features/learning/curriculum';
import { useTheme } from '@/hooks/use-theme';

export function LevelCard({
  label,
  title,
  done,
  total,
  pending = 0,
  locked,
  onPress,
}: {
  label: string;
  title: string;
  done: number;
  total: number;
  /** Completions counted in `done` that are still waiting to sync. */
  pending?: number;
  locked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const complete = total > 0 && done >= total;
  const caption = completionCaption(done, total, pending);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={`${label}: ${title}. ${caption}${locked ? '. Locked' : ''}`}
      accessibilityHint={locked ? 'Complete the previous level to unlock' : undefined}
      disabled={locked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: locked ? 0.55 : pressed ? 0.8 : 1 },
      ]}>
      <View style={styles.header}>
        <Text variant="caption" color="primary" style={styles.label}>
          {label.toUpperCase()}
        </Text>
        <Ionicons
          name={locked ? 'lock-closed' : complete ? (pending ? 'time-outline' : 'checkmark-circle') : 'chevron-forward'}
          size={18}
          color={complete && !pending ? theme.success : theme.muted}
        />
      </View>
      <Text variant="heading">{title}</Text>
      <ProgressBar value={total ? done / total : 0} label={`${label} progress`} />
      <Text variant="caption" color="muted">
        {locked ? 'Complete the previous level to unlock' : caption}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radii.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { letterSpacing: 1, fontWeight: '700' },
});
