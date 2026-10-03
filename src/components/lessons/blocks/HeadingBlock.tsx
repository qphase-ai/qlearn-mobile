import { Text } from '@/components/ui';
import { Typography } from '@/constants/theme';

import type { BlockProps } from './types';

const STYLE = { '2': Typography.title, '3': { ...Typography.heading, fontSize: 19, lineHeight: 26 }, '4': Typography.heading };

export function HeadingBlock({ text, level }: BlockProps<'heading'>) {
  return (
    <Text accessibilityRole="header" style={STYLE[level] ?? Typography.heading}>
      {text}
    </Text>
  );
}
