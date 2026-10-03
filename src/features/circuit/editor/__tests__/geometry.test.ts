import { canvasSize, cellCenter, cellFromPoint, GRID } from '../geometry';
import { MAX_COLUMNS, MAX_QUBITS } from '../types';

describe('cellCenter', () => {
  it('is the middle of the cell, right of the label gutter', () => {
    expect(cellCenter(0, 0)).toEqual({ x: GRID.LABEL_W + GRID.COL_W / 2, y: GRID.PAD_TOP + GRID.ROW_H / 2 });
    expect(cellCenter(2, 3)).toEqual({
      x: GRID.LABEL_W + 3 * GRID.COL_W + GRID.COL_W / 2,
      y: GRID.PAD_TOP + 2 * GRID.ROW_H + GRID.ROW_H / 2,
    });
  });

  it('maps back to the same cell', () => {
    const { x, y } = cellCenter(1, 7);
    expect(cellFromPoint(x, y, 2)).toEqual({ qubit: 1, column: 7 });
  });
});

describe('cellFromPoint', () => {
  it('includes the top-left edge of a cell and excludes its far edge', () => {
    expect(cellFromPoint(GRID.LABEL_W, GRID.PAD_TOP, 1)).toEqual({ qubit: 0, column: 0 });
    expect(cellFromPoint(GRID.LABEL_W + GRID.COL_W, GRID.PAD_TOP + GRID.ROW_H, 2)).toEqual({ qubit: 1, column: 1 });
  });

  it('is null in the label gutter and the top padding', () => {
    expect(cellFromPoint(GRID.LABEL_W - 1, 30, 2)).toBeNull();
    expect(cellFromPoint(60, GRID.PAD_TOP - 1, 2)).toBeNull();
  });

  it('is null below the last wire', () => {
    expect(cellFromPoint(60, GRID.PAD_TOP + 2 * GRID.ROW_H, 2)).toBeNull();
    expect(cellFromPoint(60, GRID.PAD_TOP + 2 * GRID.ROW_H - 1, 2)).toEqual({ qubit: 1, column: 0 });
  });

  it('is null past the column bound', () => {
    const lastX = GRID.LABEL_W + (MAX_COLUMNS - 1) * GRID.COL_W;
    expect(cellFromPoint(lastX, 20, 1)).toEqual({ qubit: 0, column: MAX_COLUMNS - 1 });
    expect(cellFromPoint(lastX + GRID.COL_W, 20, 1)).toBeNull();
  });

  it('is null for non-finite points', () => {
    expect(cellFromPoint(Number.NaN, 20, 1)).toBeNull();
    expect(cellFromPoint(60, Number.POSITIVE_INFINITY, 1)).toBeNull();
  });
});

describe('canvasSize', () => {
  it('leaves three empty columns after the last used one', () => {
    expect(canvasSize(2, 0)).toEqual({
      columns: 3,
      width: GRID.LABEL_W + 3 * GRID.COL_W,
      height: 2 * GRID.PAD_TOP + 2 * GRID.ROW_H,
    });
    expect(canvasSize(1, 5).columns).toBe(8);
  });

  it('never exceeds the column bound', () => {
    expect(canvasSize(1, MAX_COLUMNS - 2).columns).toBe(MAX_COLUMNS);
    expect(canvasSize(1, MAX_COLUMNS).width).toBe(GRID.LABEL_W + MAX_COLUMNS * GRID.COL_W);
  });

  it('clamps bad inputs instead of producing NaN', () => {
    const one = canvasSize(1, 0);
    expect(canvasSize(Number.NaN, Number.NaN)).toEqual(one);
    expect(canvasSize(0, -4)).toEqual(one);
    expect(canvasSize(1, Number.POSITIVE_INFINITY)).toEqual(one);
    expect(canvasSize(20, 0).height).toBe(canvasSize(MAX_QUBITS, 0).height);
  });
});
