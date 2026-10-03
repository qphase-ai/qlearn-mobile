import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { GateColors, MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { ANGLE_PRESETS, formatAngle, GATES, isTwoQubitGate, type GateParamDef } from '@/features/circuit/editor/gates';
import type { EditorGate } from '@/features/circuit/editor/types';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { IconButton } from './IconButton';

/** −/+ step, and the range the steppers keep an angle in. */
export const ANGLE_STEP = Math.PI / 12;
const ANGLE_LIMIT = 2 * Math.PI;

/** Snap to the π/12 grid, then step; clamped to ±2π. */
export function stepAngle(value: number, direction: 1 | -1): number {
  const next = (Math.round(value / ANGLE_STEP) + direction) * ANGLE_STEP;
  return Math.min(ANGLE_LIMIT, Math.max(-ANGLE_LIMIT, next));
}

const sameAngle = (a: number, b: number) => Math.abs(a - b) < 1e-9;

function ParamEditor({ gate, def }: { gate: EditorGate; def: GateParamDef }) {
  const theme = useTheme();
  const updateParams = useCircuitEditorStore((s) => s.updateParams);
  const value = gate.params?.[def.key] ?? def.default;
  const set = (next: number) => updateParams(gate.id, { [def.key]: next });

  return (
    <View style={styles.param}>
      <View style={styles.paramRow}>
        <IconButton icon="remove" label={`Decrease ${def.label}`} onPress={() => set(stepAngle(value, -1))} />
        <Text
          variant="heading"
          style={styles.paramValue}
          accessibilityLabel={`${def.label} equals ${formatAngle(value)}`}
          testID={`param-${def.key}`}>
          {`${def.label} = ${formatAngle(value)}`}
        </Text>
        <IconButton icon="add" label={`Increase ${def.label}`} onPress={() => set(stepAngle(value, 1))} />
      </View>
      <View style={styles.presets}>
        {ANGLE_PRESETS.map((preset) => {
          const active = sameAngle(value, preset.value);
          return (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              accessibilityLabel={`Set ${def.label} to ${preset.label}`}
              accessibilityState={{ selected: active }}
              onPress={() => set(preset.value)}
              style={[
                styles.preset,
                { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.overlay : 'transparent' },
              ]}>
              <Text variant="label" color={active ? 'foreground' : 'muted'}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Edits the selected gate. Renders nothing when no gate is selected. */
export function GateInspector() {
  const gate = useCircuitEditorStore((s) => s.gates.find((g) => g.id === s.selectedId) ?? null);
  const swapControlTarget = useCircuitEditorStore((s) => s.swapControlTarget);
  const removeSelected = useCircuitEditorStore((s) => s.removeSelected);
  const deselect = useCircuitEditorStore((s) => s.arm);
  if (!gate) return null;

  const def = GATES[gate.type];
  const twoQubit = isTwoQubitGate(gate.type);
  const controlled = gate.type === 'CX' || gate.type === 'CZ';
  const where = twoQubit
    ? controlled
      ? `Control q${gate.control} → target q${gate.qubit} · step ${gate.column + 1}`
      : `Qubits q${gate.control} and q${gate.qubit} · step ${gate.column + 1}`
    : `Qubit q${gate.qubit} · step ${gate.column + 1}`;

  return (
    <Card testID="gate-inspector">
      <View style={styles.header}>
        <View style={[styles.swatch, { backgroundColor: GateColors[def.colorKey] }]}>
          <Text
            variant="label"
            style={[styles.symbol, { color: gate.type === 'M' ? GateColors.labelOnLight : GateColors.label }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {def.symbol}
          </Text>
        </View>
        <View style={styles.title}>
          <Text variant="heading">{def.name}</Text>
          <Text variant="caption" color="muted">
            {where}
          </Text>
        </View>
        <IconButton icon="close" label="Done editing" onPress={() => deselect(null)} />
      </View>
      <Text variant="label" color="muted">
        {def.description}
      </Text>
      {def.params.map((p) => (
        <ParamEditor key={p.key} gate={gate} def={p} />
      ))}
      <View style={styles.actions}>
        {twoQubit ? (
          <Button
            label={controlled ? 'Swap control/target' : 'Swap qubits'}
            variant="secondary"
            onPress={() => swapControlTarget(gate.id)}
            style={styles.action}
          />
        ) : null}
        <Button label="Delete gate" variant="destructive" onPress={removeSelected} style={styles.action} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  swatch: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontWeight: '700' },
  title: { flex: 1 },
  param: { gap: Spacing.sm },
  paramRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  paramValue: { flex: 1, textAlign: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  preset: {
    minHeight: MIN_TOUCH,
    minWidth: MIN_TOUCH,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  action: { flexGrow: 1 },
});
