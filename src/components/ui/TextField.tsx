import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { MIN_TOUCH, Radii, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Text } from './Text';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, style, ...rest },
  ref
) {
  const theme = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text variant="label" color="muted">
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        placeholderTextColor={theme.muted}
        style={[
          styles.input,
          Typography.body,
          {
            color: theme.foreground,
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : theme.border,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.xs },
  input: {
    minHeight: MIN_TOUCH + 4,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
  },
});
