import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

import { CodeView } from '../markdown/CodeView';

import type { BlockProps } from './types';

export function CodeBlock({ code, language, filename, caption }: BlockProps<'code'>) {
  return (
    <View style={styles.root}>
      <CodeView code={code} language={language} filename={filename} />
      {caption ? (
        <Text variant="caption" color="muted">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: Spacing.xs } });
