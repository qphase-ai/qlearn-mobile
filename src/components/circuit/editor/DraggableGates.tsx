import { useCallback, useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Radii } from '@/constants/theme';
import { dropTarget, gateIndexAt } from '@/features/circuit/editor/drag';
import { cellCenter, GRID, type Cell } from '@/features/circuit/editor/geometry';
import { moveGate } from '@/features/circuit/editor/model';
import { MAX_COLUMNS, type EditorGate } from '@/features/circuit/editor/types';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { GateGlyph } from './GateGlyph';

/**
 * Drag to move: long-press a gate, drag its lifted copy, drop it on a cell.
 *
 * The copy follows the finger on the UI thread (Reanimated shared values);
 * the JS thread only hears about the drag when it starts, when the cell
 * under the gate changes (for the drop highlight) and when it ends. The drop
 * goes through the store's `moveGate`, so every circuit rule stays in the
 * model; a rejected drop springs the copy back and leaves the circuit as it
 * was. Drag is a pointer enhancement: screen-reader and keyboard users move
 * gates with the inspector's move buttons instead.
 */

/** Hold this long (ms) on a gate, without moving, before it lifts. Shorter than the tap's 300 ms limit. */
export const DRAG_LONG_PRESS_MS = 250;
const LIFT_SCALE = 1.08;
const LIFT_MS = 120;
/** Duration-based, so a snap-back always takes the same time however far the gate was dragged. */
const SPRING = { duration: 400, dampingRatio: 0.8 };
/** `hoverKey` before the first update of a drag, so the first cell is always reported. */
const HOVER_UNSET = -2;

type DragCell = Pick<EditorGate, 'qubit' | 'column' | 'control'>;

export interface DropHover extends Cell {
  /** Whether `moveGate` would accept this drop. */
  valid: boolean;
}

export interface CanvasDrag {
  gesture: PanGesture;
  /** The gate being dragged (also while a rejected drop springs back), or null. */
  dragged: EditorGate | null;
  /** The cell the gate would drop into, or null when it is off the grid. */
  hover: DropHover | null;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  /** 0 → 1 as the copy lifts; drives its scale and shadow. */
  lift: SharedValue<number>;
}

/**
 * The drag gesture and its state. `enabled` is false in placement mode (a
 * palette gate is armed) and while the screen-reader cells are shown.
 */
export function useCanvasDragGesture(qubitCount: number, gates: EditorGate[], enabled: boolean): CanvasDrag {
  const storeMoveGate = useCircuitEditorStore((s) => s.moveGate);
  const select = useCircuitEditorStore((s) => s.select);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<Cell | null>(null);

  const index = useSharedValue(-1);
  const hoverKey = useSharedValue(HOVER_UNSET);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lift = useSharedValue(0);

  // A plain snapshot for the worklets (ids kept on the JS side), rebuilt per edit.
  const cells = useMemo<DragCell[]>(
    () =>
      gates.map((g) => ({ qubit: g.qubit, column: g.column, ...(g.control !== undefined ? { control: g.control } : {}) })),
    [gates],
  );
  const ids = useMemo(() => gates.map((g) => g.id), [gates]);

  const start = useCallback((i: number) => {
    setDraggedId(ids[i] ?? null);
    setHoverCell(null);
  }, [ids]);

  const hover = useCallback((qubit: number, column: number) => {
    setHoverCell(qubit < 0 ? null : { qubit, column });
  }, []);

  const finish = useCallback((id: string) => {
    setDraggedId((current) => (current === id ? null : current));
  }, []);

  const drop = useCallback(
    (i: number, qubit: number, column: number) => {
      const gate = gates[i];
      setHoverCell(null);
      if (!gate) return;
      if (qubit >= 0 && storeMoveGate(gate.id, qubit, column)) {
        select(gate.id);
        translateX.set(0);
        translateY.set(0);
        lift.set(0);
        setDraggedId(null);
        return;
      }
      // Dropped back on its own cell: a long press without a move selects the gate.
      if (qubit === gate.qubit && column === gate.column) select(gate.id);
      const id = gate.id;
      const done = (finished?: boolean) => {
        'worklet';
        // Interrupted by a new drag: that drag owns the overlay now.
        if (finished) scheduleOnRN(finish, id);
      };
      // Remove the copy when the longer of the two springs settles. (A spring
      // to the value it already has calls back at once, so hanging this on a
      // fixed axis would drop the copy mid-flight after a straight drag.)
      const xLonger = Math.abs(translateX.get()) >= Math.abs(translateY.get());
      translateX.set(withSpring(0, SPRING, xLonger ? done : undefined));
      translateY.set(withSpring(0, SPRING, xLonger ? undefined : done));
      lift.set(withTiming(0, { duration: LIFT_MS }));
    },
    [finish, gates, lift, select, storeMoveGate, translateX, translateY],
  );

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId('canvas-drag')
        .enabled(enabled)
        .activateAfterLongPress(DRAG_LONG_PRESS_MS)
        .onTouchesDown((event, manager) => {
          'worklet';
          // Not on a gate: fail at once, so the tap and the scroll views keep the touch.
          const touch = event.allTouches[0];
          if (!touch || gateIndexAt(cells, touch.x, touch.y, qubitCount) < 0) manager.fail();
        })
        .onBegin((event) => {
          'worklet';
          index.set(gateIndexAt(cells, event.x, event.y, qubitCount));
        })
        .onStart(() => {
          'worklet';
          const i = index.get();
          if (i < 0) return;
          translateX.set(0);
          translateY.set(0);
          lift.set(withTiming(1, { duration: LIFT_MS }));
          hoverKey.set(HOVER_UNSET);
          scheduleOnRN(start, i);
        })
        .onUpdate((event) => {
          'worklet';
          const i = index.get();
          if (i < 0) return;
          translateX.set(event.translationX);
          translateY.set(event.translationY);
          const target = dropTarget(cells[i], event.translationX, event.translationY, qubitCount);
          const key = target ? target.qubit * MAX_COLUMNS + target.column : -1;
          if (key === hoverKey.get()) return;
          hoverKey.set(key);
          scheduleOnRN(hover, target ? target.qubit : -1, target ? target.column : -1);
        })
        .onEnd((event, success) => {
          'worklet';
          const i = index.get();
          if (i < 0) return;
          const target = success ? dropTarget(cells[i], event.translationX, event.translationY, qubitCount) : null;
          scheduleOnRN(drop, i, target ? target.qubit : -1, target ? target.column : -1);
        })
        .onFinalize(() => {
          'worklet';
          index.set(-1);
        }),
    [cells, drop, enabled, hover, hoverKey, index, lift, qubitCount, start, translateX, translateY],
  );

  const dragged = draggedId ? (gates.find((g) => g.id === draggedId) ?? null) : null;
  const hoverState = useMemo<DropHover | null>(() => {
    if (!dragged || !hoverCell) return null;
    const valid = moveGate({ qubitCount, gates }, dragged.id, hoverCell.qubit, hoverCell.column) !== null;
    return { ...hoverCell, valid };
  }, [dragged, gates, hoverCell, qubitCount]);

  return { gesture, dragged, hover: hoverState, translateX, translateY, lift };
}

/** Where a gate is drawn: its column, from the top of its first row to the bottom of its last. */
function gateBounds(gate: EditorGate) {
  const target = cellCenter(gate.qubit, gate.column);
  const other = cellCenter(gate.control ?? gate.qubit, gate.column);
  const top = Math.min(target.y, other.y) - GRID.ROW_H / 2;
  const bottom = Math.max(target.y, other.y) + GRID.ROW_H / 2;
  return { left: target.x - GRID.COL_W / 2, top, width: GRID.COL_W, height: bottom - top };
}

/** The drop-target cell, drawn inside the canvas SVG: accent when the drop is allowed, error when not. */
export function DropHighlight({ hover }: { hover: DropHover }) {
  const theme = useTheme();
  const { x, y } = cellCenter(hover.qubit, hover.column);
  const color = hover.valid ? theme.primary : theme.error;
  return (
    <Rect
      x={x - GRID.COL_W / 2 + 2}
      y={y - GRID.ROW_H / 2 + 2}
      width={GRID.COL_W - 4}
      height={GRID.ROW_H - 4}
      rx={Radii.md}
      fill={theme.overlay}
      stroke={color}
      strokeWidth={2}
      testID={hover.valid ? 'drop-target' : 'drop-target-invalid'}
    />
  );
}

/** The lifted copy of the dragged gate, over the canvas and moved on the UI thread. */
export function LiftedGate({ drag, gate }: { drag: CanvasDrag; gate: EditorGate }) {
  const theme = useTheme();
  const { translateX, translateY, lift } = drag;
  const bounds = gateBounds(gate);
  const animated = useAnimatedStyle(() => {
    const t = lift.get();
    return {
      transform: [
        { translateX: translateX.get() },
        { translateY: translateY.get() },
        { scale: 1 + (LIFT_SCALE - 1) * t },
      ],
      shadowOpacity: 0.35 * t,
      elevation: 8 * t,
    };
  });
  return (
    <Animated.View
      testID="lifted-gate"
      style={[styles.lifted, bounds, { backgroundColor: theme.elevated, shadowColor: theme.primary }, animated]}>
      <Svg
        width={bounds.width}
        height={bounds.height}
        viewBox={`${bounds.left} ${bounds.top} ${bounds.width} ${bounds.height}`}>
        <GateGlyph gate={gate} selected={false} ringColor={theme.primary} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  lifted: {
    position: 'absolute',
    borderRadius: Radii.md,
    pointerEvents: 'none',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
});
