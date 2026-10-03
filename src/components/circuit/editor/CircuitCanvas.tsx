import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type TapGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { GateColors, Radii } from '@/constants/theme';
import { formatAngle, GATES, isTwoQubitGate } from '@/features/circuit/editor/gates';
import { canvasSize, cellCenter, cellFromPoint, GRID } from '@/features/circuit/editor/geometry';
import { gateAt, usedColumns } from '@/features/circuit/editor/model';
import type { EditorGate } from '@/features/circuit/editor/types';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { DropHighlight, LiftedGate, useCanvasDragGesture } from './DraggableGates';
import { GateGlyph } from './GateGlyph';

/**
 * The editable circuit: one SVG and one tap gesture for the whole grid. A tap
 * is mapped to a cell with `cellFromPoint` and handed to the store's
 * `tapCell` state machine, so there is no component per cell. A long press
 * on a gate drags it instead (`DraggableGates`). Screen-reader users get a
 * grid of labelled cells instead, because a single SVG cannot be explored
 * cell by cell.
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

export function CircuitCanvas() {
  const theme = useTheme();
  const qubitCount = useCircuitEditorStore((s) => s.qubitCount);
  const gates = useCircuitEditorStore((s) => s.gates);
  const selectedId = useCircuitEditorStore((s) => s.selectedId);
  const pending = useCircuitEditorStore((s) => s.pendingControl);
  const armed = useCircuitEditorStore((s) => s.armed);
  const screenReader = useScreenReaderEnabled();

  const tap = useCanvasTapGesture(qubitCount, !screenReader);
  // Placement mode (a gate armed) is all taps; the screen-reader cells replace both gestures.
  const drag = useCanvasDragGesture(qubitCount, gates, !screenReader && armed === null);
  // Exclusive: the tap only fires once the drag has failed. A touch that lifts
  // before the 250 ms long press fails the drag, so quick taps are unchanged;
  // a touch held still past it lifts the gate and cancels the tap, so one
  // touch can never both tap and drag. A touch off any gate fails the drag on
  // touch-down.
  const gesture = useMemo(() => Gesture.Exclusive(drag.gesture, tap), [drag.gesture, tap]);
  const dragged = drag.dragged;
  // Core ScrollViews are outside RNGH's gesture graph, so they can't be told to
  // wait for the pan. Lock them from JS instead while a gate is lifted. There
  // is no edge auto-scroll while dragging; see `DraggableGates`.
  const scrollEnabled = !drag.dragging;

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
      <ScrollView
        nestedScrollEnabled
        scrollEnabled={scrollEnabled}
        style={styles.vertical}
        showsVerticalScrollIndicator={false}
        testID="canvas-scroll-vertical">
        <ScrollView
          horizontal
          scrollEnabled={scrollEnabled}
          showsHorizontalScrollIndicator={false}
          testID="canvas-scroll-horizontal">
          <GestureDetector gesture={gesture}>
            {/* Accessibility props live on the View: react-native-svg forwards them
                to the DOM on web, where `accessible` is not a valid attribute. */}
            <View
              style={{ width, height }}
              collapsable={false}
              accessible
              accessibilityRole="image"
              accessibilityLabel={summary}
              testID="circuit-canvas">
              <Svg width={width} height={height}>
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
                {drag.hover ? <DropHighlight hover={drag.hover} /> : null}
                {gates.map((g) => (
                  <GateGlyph
                    key={g.id}
                    gate={g}
                    selected={g.id === selectedId}
                    ringColor={theme.primary}
                    dimmed={g.id === dragged?.id}
                  />
                ))}
              </Svg>
              {dragged ? <LiftedGate drag={drag} gate={dragged} /> : null}
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
