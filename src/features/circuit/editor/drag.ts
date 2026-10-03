import { cellFromPoint, GRID, type Cell } from './geometry';
import { MAX_COLUMNS, type EditorGate } from './types';

/**
 * Pure drag-to-move arithmetic for the canvas. Both functions are worklets:
 * the drag gesture calls them on the UI thread every frame, and they still
 * run as plain functions on the JS thread and in tests.
 */

type DragGate = Pick<EditorGate, 'qubit' | 'column' | 'control'>;

/**
 * Index of the gate covering the canvas point (including the rows a
 * two-qubit gate spans), or -1 when the point is on no gate. The drag starts
 * on this gate; -1 means the touch is not a drag.
 */
export function gateIndexAt(gates: readonly DragGate[], x: number, y: number, qubitCount: number): number {
  'worklet';
  const cell = cellFromPoint(x, y, qubitCount);
  if (!cell) return -1;
  for (let i = 0; i < gates.length; i++) {
    const g = gates[i];
    if (g.column !== cell.column) continue;
    const other = g.control ?? g.qubit;
    if (cell.qubit >= Math.min(g.qubit, other) && cell.qubit <= Math.max(g.qubit, other)) return i;
  }
  return -1;
}

/**
 * The cell a dragged gate's target would drop into after the finger moved by
 * (dx, dy): the gate's target cell centre translated and rounded to the
 * nearest cell. Null when that point leaves the grid (before the first
 * column, past `MAX_COLUMNS`, above the first or below the last wire). A
 * two-qubit gate keeps its control offset, so its target is clamped to the
 * rows where the control also fits; null if the gate can't fit at all.
 *
 * Whether the cell is free is not checked here: `moveGate` decides that.
 */
export function dropTarget(gate: DragGate, dx: number, dy: number, qubitCount: number): Cell | null {
  'worklet';
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const column = gate.column + Math.round(dx / GRID.COL_W);
  let qubit = gate.qubit + Math.round(dy / GRID.ROW_H);
  if (column < 0 || column >= MAX_COLUMNS || qubit < 0 || qubit >= qubitCount) return null;
  if (gate.control !== undefined) {
    const offset = gate.control - gate.qubit;
    const lo = Math.max(0, -offset);
    const hi = Math.min(qubitCount - 1, qubitCount - 1 - offset);
    if (lo > hi) return null;
    qubit = Math.min(hi, Math.max(lo, qubit));
  }
  return { qubit, column };
}
