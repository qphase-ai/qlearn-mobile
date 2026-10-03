import { StyleSheet, View } from 'react-native';

import { CircuitDiagram } from '@/components/circuit/CircuitDiagram';
import { ProbabilityBars, StatevectorList } from '@/components/circuit/ResultViews';
import { Banner, Button, Card, Text } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { CircuitRunError, useCircuitRun } from '@/features/circuit/useCircuitRun';
import { toUserMessage } from '@/lib/api/errors';

import { AskAboutCircuit } from './AskAboutCircuit';
import { OpenInBuilder } from './OpenInBuilder';
import type { BlockProps } from './types';

/**
 * Authored simulation: the CMS stores configuration only. Running it goes
 * app → FastAPI → sandbox (Qiskit Aer), with the result over Realtime.
 */
export function SimulationBlock({ circuit, shots, view, title, description }: BlockProps<'simulation'>) {
  const { state, run } = useCircuitRun();
  const running = state.status === 'running';

  return (
    <Card>
      {title ? <Text variant="heading">{title}</Text> : null}
      {description ? (
        <Text variant="label" color="muted">
          {description}
        </Text>
      ) : null}
      <CircuitDiagram spec={circuit} />
      <View style={styles.actions}>
        <Button
          label={state.status === 'done' ? 'Run again' : 'Run simulation'}
          variant="secondary"
          loading={running}
          onPress={() => void run(circuit, shots, title || 'Lesson simulation')}
        />
        <Text variant="caption" color="muted">
          {shots} shots · runs on the Q-Learn simulator
        </Text>
      </View>
      {state.status === 'error' ? (
        <Banner
          tone="error"
          message={state.error instanceof CircuitRunError ? state.error.message : toUserMessage(state.error)}
        />
      ) : null}
      {state.status === 'done' ? (
        view === 'statevector' ? (
          <StatevectorList result={state.result} />
        ) : (
          <ProbabilityBars result={state.result} />
        )
      ) : null}
      <OpenInBuilder spec={circuit} title={title} />
      <AskAboutCircuit spec={circuit} title={title} />
    </Card>
  );
}

const styles = StyleSheet.create({ actions: { gap: Spacing.xs } });
