import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

import type { BlockProps } from './types';

/** Plain text: paragraphs split on blank lines, rendered as text only. */
export function TextBlock({ body }: BlockProps<'text'>) {
  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim());
  return (
    <View style={styles.root}>
      {paragraphs.map((p, i) => (
        <Text key={i}>{p.trim()}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: Spacing.md } });
