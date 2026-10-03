import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  label,
  variant = 'primary',
  loading = false,
  disabled,
  icon,
  style,
  ...rest
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const fill =
    variant === 'primary'
      ? theme.primary
      : variant === 'destructive'
        ? theme.error
        : variant === 'secondary'
          ? theme.overlay
          : 'transparent';
  const textColor =
    variant === 'primary' ? 'onPrimary' : variant === 'destructive' ? 'surface' : 'foreground';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: fill,
          borderColor: variant === 'secondary' ? theme.border : 'transparent',
          opacity: isDisabled ? 0.5 : state.pressed ? 0.8 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={theme[textColor]} testID="button-spinner" />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text variant="label" color={textColor} style={styles.label}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH + 4,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { fontWeight: '600' },
});
