import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { MIN_TOUCH, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LessonType } from '@/types/contracts';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_ICON: Record<string, IconName> = {
  text: 'document-text-outline',
  circuit: 'git-network-outline',
  code: 'code-slash-outline',
  quiz: 'help-circle-outline',
};

export function LessonRow({
  number,
  title,
  subtitle,
  type,
  completed,
  onPress,
}: {
  number?: string;
  title: string;
  subtitle?: string | null;
  type: LessonType | (string & {});
  completed?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${number ? `Lesson ${number}, ` : ''}${title}${completed ? ', completed' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons
        name={completed ? 'checkmark-circle' : TYPE_ICON[type] ?? 'document-text-outline'}
        size={22}
        color={completed ? theme.success : theme.muted}
      />
      <View style={styles.body}>
        <Text variant="label" numberOfLines={2}>
          {number ? `${number}  ` : ''}
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 2 },
});
