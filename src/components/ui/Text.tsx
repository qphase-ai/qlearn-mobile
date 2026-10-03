import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { Typography, type ThemeColors, type TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
}

export function Text({ variant = 'body', color = 'foreground', style, ...rest }: TextProps) {
  const theme = useTheme();
  return <RNText style={[Typography[variant], { color: theme[color] }, style]} {...rest} />;
}
