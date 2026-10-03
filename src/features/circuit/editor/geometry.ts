import { MAX_COLUMNS, MAX_QUBITS, MIN_QUBITS } from './types';

/**
 * Pixel layout of the editor canvas. The canvas is one SVG with one tap
 * gesture (no component per cell), so touches are mapped to cells here, as
 * pure arithmetic that is easy to test. The functions are worklets so the
 * drag gesture can snap to cells on the UI thread; they still run as plain
 * functions on the JS thread and in tests.
 */

export const GRID = {
  /** Width of the "q0…" label gutter left of the first column. */
  LABEL_W: 44,
  ROW_H: 56,
  COL_W: 56,
  /** Drawn gate box size, smaller than a cell so neighbours stay apart. */
  GATE: 40,
  PAD_TOP: 12,
} as const;

/** Columns kept empty after the last gate, so there is always room to place more. */
const TRAILING_COLUMNS = 3;

export interface Cell {
  qubit: number;
  column: number;
}

/** Centre of a cell in canvas coordinates. */
export function cellCenter(qubit: number, column: number): { x: number; y: number } {
  'worklet';
  return {
    x: GRID.LABEL_W + column * GRID.COL_W + GRID.COL_W / 2,
    y: GRID.PAD_TOP + qubit * GRID.ROW_H + GRID.ROW_H / 2,
  };
}

/**
 * The cell under a canvas point, or null when the point is in the label
 * gutter, the top padding, below the last wire or past `MAX_COLUMNS`.
 */
export function cellFromPoint(x: number, y: number, qubitCount: number): Cell | null {
  'worklet';
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x < GRID.LABEL_W || y < GRID.PAD_TOP) return null;
  const column = Math.floor((x - GRID.LABEL_W) / GRID.COL_W);
  const qubit = Math.floor((y - GRID.PAD_TOP) / GRID.ROW_H);
  if (qubit >= qubitCount || column >= MAX_COLUMNS) return null;
  return { qubit, column };
}

/**
 * Canvas size for a circuit using `usedColumns` columns: at least three empty
 * columns after the last gate, but never wider than `MAX_COLUMNS` columns so
 * rendering stays bounded. Padding is mirrored below the last wire. Inputs
 * are clamped (qubits to 1–8, non-finite values to the minimum) so a bad
 * value can never produce a NaN or unbounded canvas.
 */
export function canvasSize(
  qubitCount: number,
  usedColumns: number,
): { width: number; height: number; columns: number } {
  'worklet';
  const used = Number.isFinite(usedColumns) ? Math.max(0, Math.floor(usedColumns)) : 0;
  const qubits = Number.isFinite(qubitCount)
    ? Math.min(MAX_QUBITS, Math.max(MIN_QUBITS, Math.floor(qubitCount)))
    : MIN_QUBITS;
  const columns = Math.min(MAX_COLUMNS, used + TRAILING_COLUMNS);
  return {
    width: GRID.LABEL_W + columns * GRID.COL_W,
    height: GRID.PAD_TOP * 2 + qubits * GRID.ROW_H,
    columns,
  };
}
