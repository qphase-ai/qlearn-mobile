import { StyleSheet, View } from 'react-native';

import { CircuitDiagram } from '@/components/circuit/CircuitDiagram';
import { Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';

import { AskAboutCircuit } from './AskAboutCircuit';
import type { BlockProps } from './types';

export function CircuitBlock({ spec, title, description }: BlockProps<'circuit'>) {
  return (
    <View style={styles.root}>
      {title ? <Text variant="heading">{title}</Text> : null}
      <CircuitDiagram spec={spec} />
      {description ? (
        <Text variant="label" color="muted">
          {description}
        </Text>
      ) : null}
      <AskAboutCircuit spec={spec} title={title} />
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: Spacing.sm } });
