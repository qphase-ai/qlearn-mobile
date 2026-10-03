import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressBar, Text } from '@/components/ui';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function LevelCard({
  label,
  title,
  done,
  total,
  locked,
  onPress,
}: {
  label: string;
  title: string;
  done: number;
  total: number;
  locked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const complete = total > 0 && done >= total;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={`${label}: ${title}. ${done} of ${total} lessons complete${locked ? '. Locked' : ''}`}
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
          name={locked ? 'lock-closed' : complete ? 'checkmark-circle' : 'chevron-forward'}
          size={18}
          color={complete ? theme.success : theme.muted}
        />
      </View>
      <Text variant="heading">{title}</Text>
      <ProgressBar value={total ? done / total : 0} label={`${label} progress`} />
      <Text variant="caption" color="muted">
        {locked ? 'Complete the previous level to unlock' : `${done} of ${total} lessons complete`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radii.lg, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { letterSpacing: 1, fontWeight: '700' },
});
