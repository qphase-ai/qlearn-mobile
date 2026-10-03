import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProbabilityBars, StatevectorList } from '@/components/circuit/ResultViews';
import { AskAboutCircuit } from '@/components/lessons/blocks/AskAboutCircuit';
import { Banner, Button, Card, Text } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { toCircuitSpec } from '@/features/circuit/editor/serialize';
import { validateCircuit } from '@/features/circuit/editor/validate';
import { CircuitRunError, useCircuitRun } from '@/features/circuit/useCircuitRun';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { SHOT_OPTIONS, useCircuitEditorStore } from '@/stores/circuit-editor-store';

type ResultView = 'probabilities' | 'statevector';

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format: (value: T) => string;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.segmented, { borderColor: theme.border }]}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={format(option)}
            onPress={() => onChange(option)}
            style={[styles.segment, selected ? { backgroundColor: theme.primary } : null]}>
            <Text variant="label" color={selected ? 'onPrimary' : 'muted'}>
              {format(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Run the circuit on the Q-Learn simulator and show the result. */
export function RunPanel() {
  const qubitCount = useCircuitEditorStore((s) => s.qubitCount);
  const gates = useCircuitEditorStore((s) => s.gates);
  const name = useCircuitEditorStore((s) => s.name);
  const shots = useCircuitEditorStore((s) => s.shots);
  const setShots = useCircuitEditorStore((s) => s.setShots);
  const { state, run } = useCircuitRun();
  const [view, setView] = useState<ResultView>('probabilities');
  /** The spec the shown result was computed for, to flag results of an older circuit. */
  const [ranKey, setRanKey] = useState<string | null>(null);

  const spec = useMemo(() => toCircuitSpec({ qubitCount, gates }), [qubitCount, gates]);
  const specKey = useMemo(() => JSON.stringify(spec), [spec]);
  const errors = useMemo(() => validateCircuit(spec), [spec]);
  const running = state.status === 'running';
  const empty = gates.length === 0;
  const blocker = empty ? 'Add a gate to run your circuit.' : (errors[0] ?? null);

  const onRun = () => {
    const current = useCircuitEditorStore.getState().spec();
    setRanKey(JSON.stringify(current));
    void run(current, shots, name);
  };

  return (
    <Card>
      <Text variant="heading">Run</Text>
      <Segmented label="Shots" options={SHOT_OPTIONS} value={shots} onChange={setShots} format={(n) => `${n} shots`} />
      <Button
        label={state.status === 'done' ? 'Run again' : 'Run circuit'}
        loading={running}
        disabled={blocker !== null}
        onPress={onRun}
      />
      {blocker ? (
        <Text variant="caption" color={empty ? 'muted' : 'error'} testID="run-blocker">
          {blocker}
        </Text>
      ) : (
        <Text variant="caption" color="muted">
          Runs on the Q-Learn simulator, {shots} times.
        </Text>
      )}
      {state.status === 'error' ? (
        <Banner
          tone="error"
          message={state.error instanceof CircuitRunError ? state.error.message : toUserMessage(state.error)}
        />
      ) : null}
      {state.status === 'done' ? (
        <View style={styles.result}>
          <Segmented
            label="Result view"
            options={['probabilities', 'statevector'] as const}
            value={view}
            onChange={setView}
            format={(v) => (v === 'probabilities' ? 'Probabilities' : 'State vector')}
          />
          {ranKey !== specKey ? (
            <Text variant="caption" color="muted">
              You changed the circuit since this run. Run it again to update.
            </Text>
          ) : null}
          {view === 'statevector' ? <StatevectorList result={state.result} /> : <ProbabilityBars result={state.result} />}
        </View>
      ) : null}
      {empty ? null : <AskAboutCircuit spec={spec} title={name} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: Radii.md, overflow: 'hidden' },
  segment: { flex: 1, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.sm },
  result: { gap: Spacing.sm },
});
