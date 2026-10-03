import { dropTarget, gateIndexAt } from '../drag';
import { cellCenter, GRID } from '../geometry';
import { MAX_COLUMNS } from '../types';

const h = { qubit: 1, column: 2 };
const cx = { qubit: 1, control: 0, column: 3 }; // control above the target

describe('dropTarget', () => {
  it('moves within the grid by whole cells', () => {
    expect(dropTarget(h, 0, 0, 3)).toEqual({ qubit: 1, column: 2 });
    expect(dropTarget(h, 2 * GRID.COL_W, GRID.ROW_H, 3)).toEqual({ qubit: 2, column: 4 });
    expect(dropTarget(h, -2 * GRID.COL_W, -GRID.ROW_H, 3)).toEqual({ qubit: 0, column: 0 });
  });

  it('rounds to the nearest cell', () => {
    expect(dropTarget(h, GRID.COL_W * 0.49, GRID.ROW_H * 0.49, 3)).toEqual({ qubit: 1, column: 2 });
    expect(dropTarget(h, GRID.COL_W * 0.51, GRID.ROW_H * 0.51, 3)).toEqual({ qubit: 2, column: 3 });
    expect(dropTarget(h, -GRID.COL_W * 0.51, -GRID.ROW_H * 0.51, 3)).toEqual({ qubit: 0, column: 1 });
  });

  it('is null when the column leaves the grid or the input is not finite', () => {
    expect(dropTarget(h, -3 * GRID.COL_W, 0, 3)).toBeNull(); // column -1
    expect(dropTarget(h, Number.NaN, 0, 3)).toBeNull();
    expect(dropTarget(h, 0, Number.POSITIVE_INFINITY, 3)).toBeNull();
  });

  it('pins a single-qubit gate to the first or last wire', () => {
    expect(dropTarget(h, 0, -2 * GRID.ROW_H, 3)).toEqual({ qubit: 0, column: 2 });
    expect(dropTarget(h, 0, 5 * GRID.ROW_H, 3)).toEqual({ qubit: 2, column: 2 });
  });

  it('is null at or past MAX_COLUMNS', () => {
    const last = { qubit: 0, column: MAX_COLUMNS - 2 };
    expect(dropTarget(last, GRID.COL_W, 0, 1)).toEqual({ qubit: 0, column: MAX_COLUMNS - 1 });
    expect(dropTarget(last, 2 * GRID.COL_W, 0, 1)).toBeNull();
  });

  it('clamps a two-qubit gate with its control above the target, keeping the offset', () => {
    // cx: control q0, target q1 → the target can range over q1..q2 in 3 qubits.
    expect(dropTarget(cx, 0, -GRID.ROW_H, 3)).toEqual({ qubit: 1, column: 3 }); // control would be q-1
    expect(dropTarget(cx, GRID.COL_W, GRID.ROW_H, 3)).toEqual({ qubit: 2, column: 4 });
    expect(dropTarget(cx, 0, 4 * GRID.ROW_H, 3)).toEqual({ qubit: 2, column: 3 }); // target past the last wire
  });

  it('clamps a two-qubit gate with its control below the target the same way', () => {
    // control q2, target q1 → the target can range over q0..q1 in 3 qubits.
    const flipped = { qubit: 1, control: 2, column: 0 };
    expect(dropTarget(flipped, 0, GRID.ROW_H, 3)).toEqual({ qubit: 1, column: 0 }); // control would be q3
    expect(dropTarget(flipped, 0, -GRID.ROW_H, 3)).toEqual({ qubit: 0, column: 0 });
    expect(dropTarget(flipped, 0, -4 * GRID.ROW_H, 3)).toEqual({ qubit: 0, column: 0 }); // target above q0
  });

  it('is null when a two-qubit gate is taller than the circuit', () => {
    expect(dropTarget({ qubit: 0, control: 2, column: 0 }, 0, 0, 2)).toBeNull();
  });
});

describe('gateIndexAt', () => {
  const gates = [h, { qubit: 2, control: 0, column: 3 }];

  it('finds the gate under a point, including rows a two-qubit gate spans', () => {
    const at = (q: number, c: number) => {
      const { x, y } = cellCenter(q, c);
      return gateIndexAt(gates, x, y, 3);
    };
    expect(at(1, 2)).toBe(0);
    expect(at(0, 3)).toBe(1);
    expect(at(1, 3)).toBe(1); // crossed row
    expect(at(2, 3)).toBe(1);
    expect(at(0, 2)).toBe(-1);
  });

  it('is -1 outside the grid', () => {
    expect(gateIndexAt(gates, 0, 0, 3)).toBe(-1);
  });
});
