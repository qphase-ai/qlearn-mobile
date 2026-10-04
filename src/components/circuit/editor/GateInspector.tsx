import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { GateColors, MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { ANGLE_PRESETS, formatAngle, GATES, isTwoQubitGate, type GateParamDef } from '@/features/circuit/editor/gates';
import { moveGate } from '@/features/circuit/editor/model';
import { MAX_COLUMNS, type EditorCircuit, type EditorGate } from '@/features/circuit/editor/types';
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

/** Inspector moves: one cell left/right (time step) or up/down (qubit), the control keeping its offset. */
const MOVES = [
  { icon: 'arrow-back', fallback: 'Move left', dq: 0, dc: -1 },
  { icon: 'arrow-forward', fallback: 'Move right', dq: 0, dc: 1 },
  { icon: 'arrow-up', fallback: 'Move up', dq: -1, dc: 0 },
  { icon: 'arrow-down', fallback: 'Move down', dq: 1, dc: 0 },
] as const;

/** "qubit 2" or, for a two-qubit gate, "qubits 1 and 2" (numbered from 0, like the wire labels). */
function qubitsText(qubit: number, control: number | undefined): string {
  if (control === undefined) return `qubit ${qubit}`;
  return `qubits ${Math.min(qubit, control)} and ${Math.max(qubit, control)}`;
}

/**
 * Buttons that move the selected gate one cell: the non-pointer way to do what
 * drag does on the canvas. Each is labelled with its destination ("Move to
 * step 3", "Move to qubit 2"), and a move the model would reject (off the
 * grid, onto another gate) is disabled rather than silently ignored. A move
 * is announced, since the button itself doesn't change.
 */
function MoveButtons({ gate }: { gate: EditorGate }) {
  const qubitCount = useCircuitEditorStore((s) => s.qubitCount);
  const gates = useCircuitEditorStore((s) => s.gates);
  const move = useCircuitEditorStore((s) => s.moveGate);
  const circuit: EditorCircuit = { qubitCount, gates };
  return (
    <View style={styles.moves}>
      {MOVES.map(({ icon, fallback, dq, dc }) => {
        const qubit = gate.qubit + dq;
        const column = gate.column + dc;
        const control = gate.control !== undefined ? gate.control + dq : undefined;
        const moved = moveGate(circuit, gate.id, qubit, column);
        const rows = [qubit, control ?? qubit];
        const inGrid =
          column >= 0 && column < MAX_COLUMNS && Math.min(...rows) >= 0 && Math.max(...rows) < qubitCount;
        const label = !inGrid ? fallback : dc !== 0 ? `Move to step ${column + 1}` : `Move to ${qubitsText(qubit, control)}`;
        return (
          <IconButton
            key={fallback}
            icon={icon}
            label={label}
            disabled={moved === null}
            onPress={() => {
              if (!move(gate.id, qubit, column)) return;
              AccessibilityInfo.announceForAccessibility(`Moved to ${qubitsText(qubit, control)}, step ${column + 1}`);
            }}
          />
        );
      })}
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
      <MoveButtons gate={gate} />
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
  moves: { flexDirection: 'row', gap: Spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  action: { flexGrow: 1 },
});
