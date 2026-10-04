import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import { MIN_TOUCH, Radii } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Square icon-only button for the editor's toolbars (label is spoken, not shown). */
export function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  testID,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border, backgroundColor: pressed ? theme.overlay : 'transparent', opacity: disabled ? 0.4 : 1 },
      ]}>
      <Ionicons name={icon} size={20} color={theme.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
