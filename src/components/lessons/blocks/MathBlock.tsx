import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

import { Markdown } from '../markdown/Markdown';

import type { BlockProps } from './types';

export function MathBlock({ latex, displayMode, caption }: BlockProps<'math'>) {
  // Same wrapping as the web's MathBlock: block math unless displayMode is false.
  const source = displayMode === false ? `$${latex}$` : `$$\n${latex}\n$$`;
  return (
    <View style={styles.root}>
      <Markdown source={source} />
      {caption ? (
        <Text variant="caption" color="muted" style={styles.caption}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: Spacing.xs }, caption: { textAlign: 'center' } });
