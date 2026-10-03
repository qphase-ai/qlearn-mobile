import { memo, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type ComposedGesture, type GestureType, type TapGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { GateColors, Radii } from '@/constants/theme';
import { formatAngle, GATES, isTwoQubitGate } from '@/features/circuit/editor/gates';
import { canvasSize, cellCenter, cellFromPoint, GRID } from '@/features/circuit/editor/geometry';
import { gateAt, usedColumns } from '@/features/circuit/editor/model';
import type { EditorGate, GateType } from '@/features/circuit/editor/types';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

/**
 * The editable circuit: one SVG and one tap gesture for the whole grid. A tap
 * is mapped to a cell with `cellFromPoint` and handed to the store's
 * `tapCell` state machine, so there is no component per cell. Screen-reader
 * users get a grid of labelled cells instead, because a single SVG cannot be
 * explored cell by cell.
 *
 * Spoken labels number qubits from 0 (matching the `q0` wire labels and
 * Qiskit) and steps from 1.
 */

/** Taller circuits scroll inside the canvas instead of pushing the page down. */
const MAX_VIEWPORT_HEIGHT = 360;

/** How far (px) a finger may travel and still count as a tap, and for how long. */
export const TAP_MAX_DISTANCE = 10;
export const TAP_MAX_DURATION_MS = 300;

/**
 * The grid's tap gesture: tap → cell → `tapCell`, mapped on the UI thread.
 * A touch that travels more than `TAP_MAX_DISTANCE` is a scroll or a flick,
 * not a tap: the recognizer fails it (`maxDistance`), and `onEnd` checks the
 * distance again from the touch-down point, which is also the point mapped
 * to a cell (where the student aimed, not where the finger lifted).
 * Disabled while the screen-reader cells are shown, so one activation can't
 * reach the store twice.
 */
export function useCanvasTapGesture(qubitCount: number, enabled = true): TapGesture {
  const tapCell = useCircuitEditorStore((s) => s.tapCell);
  const start = useSharedValue({ x: 0, y: 0 });
  return useMemo(
    () =>
      Gesture.Tap()
        .withTestId('canvas-tap')
        .enabled(enabled)
        .maxDistance(TAP_MAX_DISTANCE)
        .maxDuration(TAP_MAX_DURATION_MS)
        .onBegin((event) => {
          'worklet';
          start.set({ x: event.x, y: event.y });
        })
        .onEnd((event, success) => {
          'worklet';
          if (!success) return;
          const { x, y } = start.get();
          if (Math.hypot(event.x - x, event.y - y) > TAP_MAX_DISTANCE) return;
          const cell = cellFromPoint(x, y, qubitCount);
          if (cell) scheduleOnRN(tapCell, cell.qubit, cell.column);
        }),
    [enabled, qubitCount, start, tapCell],
  );
}

/** Whether a screen reader is on, kept current while it is toggled. */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return enabled;
}

const gateFill = (type: GateType) => GateColors[GATES[type].colorKey];
const labelFill = (type: GateType) => (type === 'M' ? GateColors.labelOnLight : GateColors.label);

/** CX/CZ draw their target as the X/Z they apply, like the read-only diagram. */
function bodyLabel(type: GateType): string {
  if (type === 'CX') return 'X';
  if (type === 'CZ') return 'Z';
  return GATES[type].symbol;
}

const qubitWord = (q: number) => `qubit ${q}`;

/** One gate described for a screen reader, e.g. "CNOT, control qubit 0, target qubit 1". */
export function describeGate(gate: EditorGate): string {
  const def = GATES[gate.type];
  const angle = gate.params?.theta !== undefined ? ` ${formatAngle(gate.params.theta)}` : '';
  if (!isTwoQubitGate(gate.type)) return `${def.name}${angle} on ${qubitWord(gate.qubit)}`;
  const controlled = gate.type === 'CX' || gate.type === 'CZ';
  return controlled
    ? `${def.name}, control ${qubitWord(gate.control ?? 0)}, target ${qubitWord(gate.qubit)}`
    : `${def.name}${angle} on qubits ${gate.control} and ${gate.qubit}`;
}

/** The canvas summary read before the cells. */
export function circuitSummary(qubitCount: number, gates: EditorGate[]): string {
  const head = `Circuit with ${qubitCount} qubit${qubitCount === 1 ? '' : 's'} and ${gates.length} gate${gates.length === 1 ? '' : 's'}`;
  if (gates.length === 0) return `${head}.`;
  const parts = [...gates]
    .sort((a, b) => a.column - b.column || a.qubit - b.qubit)
    .map((g) => `step ${g.column + 1}: ${describeGate(g)}`);
  return `${head}. ${parts.join('; ')}.`;
}

/** Label for one screen-reader cell, e.g. "Qubit 1, step 3, H gate" or "…, empty". */
export function cellLabel(gate: EditorGate | null, qubit: number, column: number): string {
  const where = `Qubit ${qubit}, step ${column + 1}`;
  if (!gate) return `${where}, empty`;
  const name = GATES[gate.type].name;
  if (!isTwoQubitGate(gate.type)) return `${where}, ${name} gate`;
  const controlled = gate.type === 'CX' || gate.type === 'CZ';
  if (qubit === gate.qubit) {
    return controlled
      ? `${where}, ${name} target, controlled by qubit ${gate.control}`
      : `${where}, ${name} gate with qubit ${gate.control}`;
  }
  if (qubit === gate.control) {
    return controlled
      ? `${where}, ${name} control for qubit ${gate.qubit}`
      : `${where}, ${name} gate with qubit ${gate.qubit}`;
  }
  return `${where}, crossed by ${name}`;
}

interface GateGlyphProps {
  gate: EditorGate;
  selected: boolean;
  /** Selection ring color (theme accent), passed in so the glyph stays theme-free. */
  ringColor: string;
}

/** One gate's drawing. Memoized: an edit only redraws the gates it changed. */
export const GateGlyph = memo(function GateGlyph({ gate, selected, ringColor }: GateGlyphProps) {
  const { type, qubit, column, control } = gate;
  const fill = gateFill(type);
  const target = cellCenter(qubit, column);
  const half = GRID.GATE / 2;
  const twoQubit = control !== undefined && isTwoQubitGate(type);
  const other = twoQubit ? cellCenter(control, column) : null;
  const angle = gate.params?.theta !== undefined ? formatAngle(gate.params.theta) : null;
  const label = bodyLabel(type);

  const box = (y: number, key: string) => (
    <G key={key}>
      <Rect x={target.x - half} y={y - half} width={GRID.GATE} height={GRID.GATE} rx={Radii.sm} fill={fill} />
      <SvgText
        x={target.x}
        y={angle ? y - 2 : y + 4}
        fontSize={label.length > 2 ? 10 : 13}
        fontWeight="700"
        fill={labelFill(type)}
        textAnchor="middle">
        {label}
      </SvgText>
      {angle ? (
        <SvgText x={target.x} y={y + 12} fontSize={9} fill={labelFill(type)} textAnchor="middle">
          {angle}
        </SvgText>
      ) : null}
    </G>
  );

  const cross = (y: number, key: string) => (
    <G key={key}>
      <Line x1={target.x - 7} y1={y - 7} x2={target.x + 7} y2={y + 7} stroke={fill} strokeWidth={2.5} />
      <Line x1={target.x - 7} y1={y + 7} x2={target.x + 7} y2={y - 7} stroke={fill} strokeWidth={2.5} />
    </G>
  );

  let body: React.ReactNode;
  if (!other) body = box(target.y, 't');
  else if (type === 'SWAP') body = [cross(other.y, 'c'), cross(target.y, 't')];
  else if (type === 'CX' || type === 'CZ')
    body = [<Circle key="c" cx={other.x} cy={other.y} r={6} fill={fill} />, box(target.y, 't')];
  else body = [box(other.y, 'c'), box(target.y, 't')];

  const top = Math.min(target.y, other?.y ?? target.y);
  const bottom = Math.max(target.y, other?.y ?? target.y);
  return (
    <G>
      {other ? <Line x1={target.x} y1={top} x2={target.x} y2={bottom} stroke={fill} strokeWidth={2} /> : null}
      {body}
      {selected ? (
        <Rect
          x={target.x - half - 4}
          y={top - half - 4}
          width={GRID.GATE + 8}
          height={bottom - top + GRID.GATE + 8}
          rx={Radii.md}
          fill="none"
          stroke={ringColor}
          strokeWidth={2.5}
          testID="selection-ring"
        />
      ) : null}
    </G>
  );
});

interface ScreenReaderGridProps {
  qubitCount: number;
  columns: number;
  gates: EditorGate[];
  selectedId: string | null;
}

/** Transparent, labelled cells over the SVG, rendered only for screen-reader users. */
function ScreenReaderGrid({ qubitCount, columns, gates, selectedId }: ScreenReaderGridProps) {
  const tapCell = useCircuitEditorStore((s) => s.tapCell);
  const armed = useCircuitEditorStore((s) => s.armed);
  const pending = useCircuitEditorStore((s) => s.pendingControl);
  const circuit = { qubitCount, gates };
  const hint = armed
    ? isTwoQubitGate(armed)
      ? pending
        ? `Sets the second qubit of the ${GATES[armed].name}`
        : `Sets the first qubit of the ${GATES[armed].name}`
      : `Places the ${GATES[armed].name} gate`
    : undefined;

  const cells: React.ReactNode[] = [];
  for (let q = 0; q < qubitCount; q++) {
    for (let c = 0; c < columns; c++) {
      const gate = gateAt(circuit, q, c);
      const isPending = pending?.qubit === q && pending.column === c;
      cells.push(
        <Pressable
          key={`${q}:${c}`}
          testID={`canvas-cell-${q}-${c}`}
          accessibilityRole="button"
          accessibilityLabel={`${cellLabel(gate, q, c)}${isPending ? ', first qubit chosen' : ''}`}
          accessibilityHint={hint}
          accessibilityState={{ selected: !!gate && gate.id === selectedId }}
          onPress={() => tapCell(q, c)}
          style={[
            styles.cell,
            { left: GRID.LABEL_W + c * GRID.COL_W, top: GRID.PAD_TOP + q * GRID.ROW_H },
          ]}
        />,
      );
    }
  }
  return <>{cells}</>;
}

export interface CircuitCanvasProps {
  /**
   * Compose more gestures with the grid tap (e.g. drag to move). Receives the
   * tap gesture and returns the gesture to attach; defaults to the tap alone.
   */
  composeGesture?: (tap: TapGesture) => ComposedGesture | GestureType;
}

export function CircuitCanvas({ composeGesture }: CircuitCanvasProps) {
  const theme = useTheme();
  const qubitCount = useCircuitEditorStore((s) => s.qubitCount);
  const gates = useCircuitEditorStore((s) => s.gates);
  const selectedId = useCircuitEditorStore((s) => s.selectedId);
  const pending = useCircuitEditorStore((s) => s.pendingControl);
  const screenReader = useScreenReaderEnabled();

  const tap = useCanvasTapGesture(qubitCount, !screenReader);
  const gesture = useMemo(() => (composeGesture ? composeGesture(tap) : tap), [composeGesture, tap]);

  const { width, height, columns } = canvasSize(qubitCount, usedColumns({ qubitCount, gates }));
  const summary = useMemo(() => circuitSummary(qubitCount, gates), [qubitCount, gates]);
  const gridBottom = GRID.PAD_TOP + qubitCount * GRID.ROW_H;

  const backdrop = useMemo(
    () => (
      <>
        {Array.from({ length: columns + 1 }, (_, c) => (
          <Line
            key={`col-${c}`}
            x1={GRID.LABEL_W + c * GRID.COL_W}
            y1={GRID.PAD_TOP}
            x2={GRID.LABEL_W + c * GRID.COL_W}
            y2={gridBottom}
            stroke={theme.border}
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: qubitCount }, (_, q) => {
          const y = cellCenter(q, 0).y;
          return (
            <G key={`wire-${q}`}>
              <SvgText x={GRID.LABEL_W - 10} y={y + 4} fontSize={12} fill={theme.muted} textAnchor="end">
                {`q${q}`}
              </SvgText>
              <Line x1={GRID.LABEL_W} y1={y} x2={width} y2={y} stroke={GateColors.wire} strokeWidth={1.5} />
            </G>
          );
        })}
      </>
    ),
    [columns, gridBottom, qubitCount, theme.border, theme.muted, width],
  );

  const pendingCenter = pending ? cellCenter(pending.qubit, pending.column) : null;

  return (
    <View style={[styles.frame, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
      <ScrollView nestedScrollEnabled style={styles.vertical} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <GestureDetector gesture={gesture}>
            <View style={{ width, height }} collapsable={false}>
              <Svg
                width={width}
                height={height}
                accessible
                accessibilityRole="image"
                accessibilityLabel={summary}
                testID="circuit-canvas">
                {backdrop}
                {pendingCenter ? (
                  <Rect
                    x={pendingCenter.x - GRID.COL_W / 2 + 2}
                    y={pendingCenter.y - GRID.ROW_H / 2 + 2}
                    width={GRID.COL_W - 4}
                    height={GRID.ROW_H - 4}
                    rx={Radii.md}
                    fill={theme.overlay}
                    stroke={theme.primary}
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    testID="pending-control"
                  />
                ) : null}
                {gates.map((g) => (
                  <GateGlyph key={g.id} gate={g} selected={g.id === selectedId} ringColor={theme.primary} />
                ))}
              </Svg>
              {screenReader ? (
                <ScreenReaderGrid qubitCount={qubitCount} columns={columns} gates={gates} selectedId={selectedId} />
              ) : null}
            </View>
          </GestureDetector>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { borderRadius: Radii.md, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  vertical: { maxHeight: MAX_VIEWPORT_HEIGHT, flexGrow: 0 },
  cell: { position: 'absolute', width: GRID.COL_W, height: GRID.ROW_H },
});
