import {
  gateAt,
  gateRows,
  moveGate,
  nextFreeColumn,
  occupied,
  placeGate,
  placeTwoQubitGate,
  removeGate,
  setQubitCount,
  swapControlTarget,
  updateParams,
  usedColumns,
} from '../model';
import { MAX_COLUMNS, type EditorCircuit } from '../types';

const empty = (qubitCount = 3): EditorCircuit => ({ qubitCount, gates: [] });

/** Unwrap an op that must succeed. */
function ok(circuit: EditorCircuit | null): EditorCircuit {
  if (!circuit) throw new Error('expected the op to succeed');
  return circuit;
}

describe('gateRows', () => {
  it('is the target row for a single-qubit gate', () => {
    expect(gateRows({ qubit: 2 })).toEqual([2]);
  });

  it('spans every row between control and target, either way round', () => {
    expect(gateRows({ qubit: 3, control: 0 })).toEqual([0, 1, 2, 3]);
    expect(gateRows({ qubit: 0, control: 2 })).toEqual([0, 1, 2]);
  });
});

describe('occupied / nextFreeColumn', () => {
  const c: EditorCircuit = {
    qubitCount: 3,
    gates: [
      { id: 'a', type: 'H', qubit: 0, column: 0 },
      { id: 'b', type: 'CX', qubit: 2, control: 0, column: 1 },
    ],
  };

  it('covers the spanned rows of two-qubit gates', () => {
    expect([...occupied(c)].sort()).toEqual(['0:0', '0:1', '1:1', '2:1']);
  });

  it('ignores the given ids', () => {
    expect([...occupied(c, new Set(['b']))]).toEqual(['0:0']);
  });

  it('finds the first column where every row is free', () => {
    const cells = occupied(c);
    expect(nextFreeColumn(cells, [0])).toBe(2);
    expect(nextFreeColumn(cells, [1])).toBe(0);
    expect(nextFreeColumn(cells, [1], 1)).toBe(2);
    expect(nextFreeColumn(cells, [2], -4)).toBe(0);
  });
});

describe('placeGate', () => {
  it('places a gate with no params for fixed gates', () => {
    const c = ok(placeGate(empty(), 'H', 1, 2, 'g1'));
    expect(c.gates).toEqual([{ id: 'g1', type: 'H', qubit: 1, column: 2 }]);
  });

  it('gives parametric gates their default params', () => {
    const c = ok(placeGate(empty(), 'U', 0, 0, 'g1'));
    expect(c.gates[0].params).toEqual({ theta: Math.PI / 2, phi: 0, lambda: 0 });
  });

  it('does not mutate the input circuit', () => {
    const start = empty();
    placeGate(start, 'H', 0, 0, 'g1');
    expect(start.gates).toHaveLength(0);
  });

  it('shifts right when the cell is occupied', () => {
    let c = ok(placeGate(empty(), 'H', 0, 0, 'a'));
    c = ok(placeGate(c, 'X', 0, 0, 'b'));
    c = ok(placeGate(c, 'Z', 0, 0, 'c'));
    expect(c.gates.map((g) => g.column)).toEqual([0, 1, 2]);
  });

  it('treats the rows spanned by a two-qubit gate as occupied', () => {
    const c = ok(placeTwoQubitGate(empty(), 'CX', 0, 2, 0, 'cx'));
    const placed = ok(placeGate(c, 'H', 1, 0, 'h'));
    expect(placed.gates[1].column).toBe(1);
  });

  it('rejects a duplicate id', () => {
    const c = ok(placeGate(empty(), 'H', 0, 0, 'g1'));
    expect(placeGate(c, 'X', 1, 0, 'g1')).toBeNull();
    expect(placeTwoQubitGate(c, 'CX', 1, 2, 0, 'g1')).toBeNull();
  });

  it('rejects two-qubit types', () => {
    expect(placeGate(empty(), 'CX', 0, 0, 'g')).toBeNull();
  });

  it('rejects out-of-range qubits and columns', () => {
    expect(placeGate(empty(2), 'H', 2, 0, 'g')).toBeNull();
    expect(placeGate(empty(2), 'H', -1, 0, 'g')).toBeNull();
    expect(placeGate(empty(2), 'H', 0, -1, 'g')).toBeNull();
    expect(placeGate(empty(2), 'H', 0, MAX_COLUMNS, 'g')).toBeNull();
    expect(placeGate(empty(2), 'H', 0.5, 0, 'g')).toBeNull();
  });

  it('accepts the last column but rejects a shift past MAX_COLUMNS', () => {
    const c = ok(placeGate(empty(1), 'H', 0, MAX_COLUMNS - 1, 'last'));
    expect(c.gates[0].column).toBe(MAX_COLUMNS - 1);
    expect(placeGate(c, 'X', 0, MAX_COLUMNS - 1, 'over')).toBeNull();
  });
});

describe('placeTwoQubitGate', () => {
  it('stores the target as qubit and the second qubit as control', () => {
    const c = ok(placeTwoQubitGate(empty(), 'CX', 0, 1, 0, 'cx'));
    expect(c.gates).toEqual([{ id: 'cx', type: 'CX', qubit: 1, control: 0, column: 0 }]);
  });

  it('gives parametric two-qubit gates their default θ', () => {
    const c = ok(placeTwoQubitGate(empty(), 'RZZ', 0, 1, 0, 'r'));
    expect(c.gates[0].params).toEqual({ theta: Math.PI / 2 });
  });

  it('uses the first column free on every spanned row', () => {
    let c = ok(placeGate(empty(), 'H', 1, 0, 'h'));
    c = ok(placeGate(c, 'X', 2, 1, 'x'));
    c = ok(placeTwoQubitGate(c, 'CX', 0, 2, 0, 'cx'));
    expect(c.gates[2].column).toBe(2);
  });

  it('rejects control === target, out-of-range qubits and single-qubit types', () => {
    expect(placeTwoQubitGate(empty(), 'CX', 1, 1, 0, 'g')).toBeNull();
    expect(placeTwoQubitGate(empty(), 'CX', 0, 3, 0, 'g')).toBeNull();
    expect(placeTwoQubitGate(empty(), 'CX', -1, 0, 0, 'g')).toBeNull();
    expect(placeTwoQubitGate(empty(), 'H', 0, 1, 0, 'g')).toBeNull();
  });

  it('rejects a placement shifted past MAX_COLUMNS', () => {
    const c = ok(placeGate(empty(2), 'H', 1, MAX_COLUMNS - 1, 'h'));
    expect(placeTwoQubitGate(c, 'CX', 0, 1, MAX_COLUMNS - 1, 'cx')).toBeNull();
  });
});

describe('moveGate', () => {
  const base: EditorCircuit = {
    qubitCount: 4,
    gates: [
      { id: 'cx', type: 'CX', qubit: 1, control: 0, column: 0 },
      { id: 'h', type: 'H', qubit: 3, column: 2 },
    ],
  };

  it('moves a single-qubit gate', () => {
    const c = ok(moveGate(base, 'h', 2, 5));
    expect(c.gates[1]).toEqual({ id: 'h', type: 'H', qubit: 2, column: 5 });
    expect(base.gates[1].qubit).toBe(3);
  });

  it('keeps the control offset when moving a two-qubit gate', () => {
    const c = ok(moveGate(base, 'cx', 3, 1));
    expect(c.gates[0]).toMatchObject({ qubit: 3, control: 2, column: 1 });
  });

  it('rejects a move that pushes the control out of range', () => {
    expect(moveGate(base, 'cx', 0, 1)).toBeNull();
  });

  it('rejects out-of-range targets and columns', () => {
    expect(moveGate(base, 'h', 4, 0)).toBeNull();
    expect(moveGate(base, 'h', 0, -1)).toBeNull();
    expect(moveGate(base, 'h', 0, MAX_COLUMNS)).toBeNull();
  });

  it('rejects overlapping another gate, including spanned rows, without shifting', () => {
    expect(moveGate(base, 'h', 1, 0)).toBeNull();
    expect(moveGate(base, 'cx', 3, 2)).toBeNull();
    const wide: EditorCircuit = {
      qubitCount: 3,
      gates: [
        { id: 'cx', type: 'CX', qubit: 2, control: 0, column: 0 },
        { id: 'h', type: 'H', qubit: 1, column: 1 },
      ],
    };
    expect(moveGate(wide, 'h', 1, 0)).toBeNull();
  });

  it('may overlap its own previous cells', () => {
    const c = ok(moveGate(base, 'cx', 2, 0));
    expect(c.gates[0]).toMatchObject({ qubit: 2, control: 1, column: 0 });
  });

  it('returns the same circuit for a move to the current cell, and null for unknown ids', () => {
    expect(moveGate(base, 'h', 3, 2)).toBe(base);
    expect(moveGate(base, 'nope', 0, 0)).toBeNull();
  });
});

describe('updateParams', () => {
  const base: EditorCircuit = {
    qubitCount: 1,
    gates: [
      { id: 'u', type: 'U', qubit: 0, column: 0, params: { theta: 1, phi: 2, lambda: 3 } },
      { id: 'h', type: 'H', qubit: 0, column: 1 },
    ],
  };

  it('merges finite values into the existing params', () => {
    const c = ok(updateParams(base, 'u', { phi: -Math.PI }));
    expect(c.gates[0].params).toEqual({ theta: 1, phi: -Math.PI, lambda: 3 });
    expect(base.gates[0].params).toEqual({ theta: 1, phi: 2, lambda: 3 });
  });

  it('ignores non-finite values and keys the gate does not define', () => {
    const rx: EditorCircuit = { qubitCount: 1, gates: [{ id: 'r', type: 'RX', qubit: 0, column: 0, params: { theta: 1 } }] };
    expect(updateParams(rx, 'r', { theta: NaN })).toBe(rx);
    expect(updateParams(rx, 'r', { theta: Infinity })).toBe(rx);
    expect(updateParams(rx, 'r', { phi: 2 })).toBe(rx);
    expect(ok(updateParams(rx, 'r', { theta: 2, phi: 2 })).gates[0].params).toEqual({ theta: 2 });
  });

  it('returns the same circuit when nothing changes', () => {
    expect(updateParams(base, 'u', { theta: 1 })).toBe(base);
  });

  it('rejects fixed gates and unknown ids', () => {
    expect(updateParams(base, 'h', { theta: 1 })).toBeNull();
    expect(updateParams(base, 'nope', { theta: 1 })).toBeNull();
  });
});

describe('swapControlTarget', () => {
  it('swaps the qubits and keeps the column', () => {
    const c: EditorCircuit = { qubitCount: 3, gates: [{ id: 'cx', type: 'CX', qubit: 2, control: 0, column: 4 }] };
    expect(ok(swapControlTarget(c, 'cx')).gates[0]).toEqual({ id: 'cx', type: 'CX', qubit: 0, control: 2, column: 4 });
  });

  it('rejects single-qubit gates and unknown ids', () => {
    const c: EditorCircuit = { qubitCount: 1, gates: [{ id: 'h', type: 'H', qubit: 0, column: 0 }] };
    expect(swapControlTarget(c, 'h')).toBeNull();
    expect(swapControlTarget(c, 'nope')).toBeNull();
  });
});

describe('removeGate', () => {
  it('removes by id', () => {
    const c: EditorCircuit = {
      qubitCount: 1,
      gates: [
        { id: 'a', type: 'H', qubit: 0, column: 0 },
        { id: 'b', type: 'X', qubit: 0, column: 1 },
      ],
    };
    expect(ok(removeGate(c, 'a')).gates.map((g) => g.id)).toEqual(['b']);
    expect(c.gates).toHaveLength(2);
    expect(removeGate(c, 'nope')).toBeNull();
  });
});

describe('setQubitCount', () => {
  const base: EditorCircuit = {
    qubitCount: 4,
    gates: [
      { id: 'h0', type: 'H', qubit: 0, column: 0 },
      { id: 'cx', type: 'CX', qubit: 1, control: 3, column: 1 },
      { id: 'cz', type: 'CZ', qubit: 1, control: 0, column: 2 },
      { id: 'x3', type: 'X', qubit: 3, column: 0 },
    ],
  };

  it('drops gates that touch removed rows when shrinking', () => {
    const c = setQubitCount(base, 2);
    expect(c.qubitCount).toBe(2);
    expect(c.gates.map((g) => g.id)).toEqual(['h0', 'cz']);
  });

  it('keeps every gate when growing', () => {
    expect(setQubitCount(base, 6).gates).toHaveLength(4);
  });

  it('clamps to 1–8 and rounds', () => {
    expect(setQubitCount(base, 0).qubitCount).toBe(1);
    expect(setQubitCount(base, 20).qubitCount).toBe(8);
    expect(setQubitCount(base, 2.6).qubitCount).toBe(3);
    expect(setQubitCount(base, NaN).qubitCount).toBe(1);
  });

  it('returns the same circuit for an unchanged count', () => {
    expect(setQubitCount(base, 4)).toBe(base);
  });
});

describe('gateAt / usedColumns', () => {
  const c: EditorCircuit = {
    qubitCount: 3,
    gates: [
      { id: 'cx', type: 'CX', qubit: 2, control: 0, column: 0 },
      { id: 'h', type: 'H', qubit: 1, column: 3 },
    ],
  };

  it('finds the gate covering a cell, including spanned rows', () => {
    expect(gateAt(c, 0, 0)?.id).toBe('cx');
    expect(gateAt(c, 1, 0)?.id).toBe('cx');
    expect(gateAt(c, 2, 0)?.id).toBe('cx');
    expect(gateAt(c, 1, 3)?.id).toBe('h');
    expect(gateAt(c, 0, 3)).toBeNull();
  });

  it('counts columns up to the last used one', () => {
    expect(usedColumns(c)).toBe(4);
    expect(usedColumns(empty())).toBe(0);
  });
});
