import Storage from 'expo-sqlite/kv-store';

import type { EditorGate } from '@/features/circuit/editor/types';
import type { CircuitSpec } from '@/types/contracts';

import {
  DEFAULT_NAME,
  HISTORY_LIMIT,
  sanitizeDraft,
  useCircuitEditorStore,
} from '../circuit-editor-store';

// jest.mock calls are hoisted above the imports by babel-jest.
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `gate-${++n}` };
});

const initial = useCircuitEditorStore.getState();
const store = () => useCircuitEditorStore.getState();

beforeEach(() => {
  useCircuitEditorStore.setState(
    {
      ...initial,
      qubitCount: 2,
      gates: [],
      name: DEFAULT_NAME,
      shots: 1024,
      selectedId: null,
      armed: null,
      pendingControl: null,
      past: [],
      future: [],
    },
    true,
  );
});

const h = (id: string, qubit: number, column: number): EditorGate => ({ id, type: 'H', qubit, column });

describe('arming', () => {
  it('arms a gate, clearing selection and a pending control', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0)], selectedId: 'a', pendingControl: { qubit: 0, column: 1 } });
    store().arm('X');
    expect(store()).toMatchObject({ armed: 'X', selectedId: null, pendingControl: null });
  });

  it('disarms when the armed gate is tapped again or with null', () => {
    store().arm('X');
    store().arm('X');
    expect(store().armed).toBeNull();
    store().arm('H');
    store().arm(null);
    expect(store().armed).toBeNull();
  });

  it('switching gates clears a pending control', () => {
    store().arm('CX');
    store().tapCell(0, 0);
    store().arm('CZ');
    expect(store()).toMatchObject({ armed: 'CZ', pendingControl: null });
  });
});

describe('tapCell', () => {
  it('places single-qubit gates and stays armed (sticky)', () => {
    store().arm('H');
    store().tapCell(0, 0);
    store().tapCell(1, 2);
    expect(store().armed).toBe('H');
    expect(store().gates).toEqual([
      { id: expect.any(String), type: 'H', qubit: 0, column: 0 },
      { id: expect.any(String), type: 'H', qubit: 1, column: 2 },
    ]);
    expect(store().selectedId).toBeNull();
  });

  it('places a two-qubit gate in two taps: control, then target', () => {
    store().arm('CX');
    store().tapCell(0, 1);
    expect(store().pendingControl).toEqual({ qubit: 0, column: 1 });
    expect(store().gates).toHaveLength(0);
    store().tapCell(1, 1);
    expect(store().pendingControl).toBeNull();
    expect(store().gates).toEqual([{ id: expect.any(String), type: 'CX', qubit: 1, control: 0, column: 1 }]);
    expect(store().armed).toBe('CX');
  });

  it('uses the pending column even when the second tap is in another column', () => {
    store().arm('CZ');
    store().tapCell(1, 2);
    store().tapCell(0, 5);
    expect(store().gates).toEqual([{ id: expect.any(String), type: 'CZ', qubit: 0, control: 1, column: 2 }]);
  });

  it('cancels a pending control when the same qubit is tapped again', () => {
    store().arm('CX');
    store().tapCell(0, 0);
    store().tapCell(0, 3);
    expect(store().pendingControl).toBeNull();
    expect(store().gates).toHaveLength(0);
    expect(store().past).toHaveLength(0);
    expect(store().armed).toBe('CX');
  });

  it('ignores a first tap outside the wires', () => {
    store().arm('CX');
    store().tapCell(5, 0);
    expect(store().pendingControl).toBeNull();
  });

  it('selects the gate under the tap when unarmed, including rows a control spans', () => {
    useCircuitEditorStore.setState({
      qubitCount: 3,
      gates: [h('a', 0, 0), { id: 'cx', type: 'CX', qubit: 2, control: 0, column: 1 }],
    });
    store().tapCell(0, 0);
    expect(store().selectedId).toBe('a');
    store().tapCell(1, 1);
    expect(store().selectedId).toBe('cx');
  });

  it('deselects on an empty cell', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0)], selectedId: 'a' });
    store().tapCell(1, 0);
    expect(store().selectedId).toBeNull();
  });
});

describe('editing actions', () => {
  it('moves a gate and reports rejected drops', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0), h('b', 1, 0)] });
    expect(store().moveGate('a', 0, 3)).toBe(true);
    expect(store().gates[0]).toMatchObject({ id: 'a', column: 3 });
    expect(store().moveGate('a', 1, 0)).toBe(false);
    expect(store().past).toHaveLength(1);
  });

  it('updates params and swaps control/target', () => {
    useCircuitEditorStore.setState({
      gates: [
        { id: 'r', type: 'RX', qubit: 0, column: 0, params: { theta: 1 } },
        { id: 'cx', type: 'CX', qubit: 1, control: 0, column: 1 },
      ],
    });
    store().updateParams('r', { theta: 2 });
    store().swapControlTarget('cx');
    expect(store().gates).toEqual([
      { id: 'r', type: 'RX', qubit: 0, column: 0, params: { theta: 2 } },
      { id: 'cx', type: 'CX', qubit: 0, control: 1, column: 1 },
    ]);
    expect(store().past).toHaveLength(2);
  });

  it('removes the selected gate and clears the selection', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0), h('b', 1, 0)], selectedId: 'a' });
    store().removeSelected();
    expect(store().gates.map((g) => g.id)).toEqual(['b']);
    expect(store().selectedId).toBeNull();
  });

  it('does nothing on removeSelected without a selection', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0)] });
    store().removeSelected();
    expect(store().gates).toHaveLength(1);
    expect(store().past).toHaveLength(0);
  });

  it('shrinking drops gates on removed rows, the selection and a pending control', () => {
    useCircuitEditorStore.setState({
      qubitCount: 3,
      gates: [h('a', 0, 0), h('b', 2, 0)],
      selectedId: 'b',
      pendingControl: { qubit: 0, column: 4 },
    });
    store().setQubitCount(2);
    expect(store()).toMatchObject({ qubitCount: 2, selectedId: null, pendingControl: null });
    expect(store().gates.map((g) => g.id)).toEqual(['a']);
  });

  it('clear keeps the qubit count and is undoable', () => {
    useCircuitEditorStore.setState({ qubitCount: 3, gates: [h('a', 0, 0)] });
    store().clear();
    expect(store()).toMatchObject({ qubitCount: 3, gates: [] });
    store().undo();
    expect(store().gates).toHaveLength(1);
  });

  it('accepts only the offered shot counts', () => {
    store().setShots(4096);
    expect(store().shots).toBe(4096);
    store().setShots(5 as never);
    expect(store().shots).toBe(4096);
  });

  it('renames to one trimmed line, falling back to the default', () => {
    store().rename('  Bell\n test ');
    expect(store().name).toBe('Bell test');
    store().rename('   ');
    expect(store().name).toBe(DEFAULT_NAME);
  });

  it('spec() is the canonical serialization of the current circuit', () => {
    useCircuitEditorStore.setState({ gates: [{ id: 'm', type: 'M', qubit: 1, column: 0 }, h('a', 0, 0)] });
    expect(store().spec()).toEqual({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'M', targets: [1], classical: [1] },
      ],
    });
  });
});

describe('history', () => {
  it('undoes and redoes placements', () => {
    store().arm('H');
    store().tapCell(0, 0);
    store().tapCell(0, 0);
    expect(store().gates).toHaveLength(2);
    store().undo();
    expect(store().gates).toHaveLength(1);
    store().undo();
    expect(store().gates).toHaveLength(0);
    store().undo();
    expect(store().gates).toHaveLength(0);
    store().redo();
    store().redo();
    expect(store().gates.map((g) => g.column)).toEqual([0, 1]);
    store().redo();
    expect(store().gates).toHaveLength(2);
  });

  it('restores the qubit count with the gates', () => {
    useCircuitEditorStore.setState({ qubitCount: 3, gates: [h('a', 2, 0)] });
    store().setQubitCount(1);
    store().undo();
    expect(store()).toMatchObject({ qubitCount: 3, gates: [h('a', 2, 0)] });
    store().redo();
    expect(store()).toMatchObject({ qubitCount: 1, gates: [] });
  });

  it('a new edit clears the redo stack', () => {
    store().arm('H');
    store().tapCell(0, 0);
    store().undo();
    store().tapCell(1, 0);
    expect(store().future).toEqual([]);
    store().redo();
    expect(store().gates).toEqual([{ id: expect.any(String), type: 'H', qubit: 1, column: 0 }]);
  });

  it('clears a selection whose gate disappears on undo or redo', () => {
    store().arm('H');
    store().tapCell(0, 0);
    store().arm(null);
    const id = store().gates[0].id;
    store().tapCell(0, 0);
    expect(store().selectedId).toBe(id);
    store().undo();
    expect(store().selectedId).toBeNull();
    store().redo();
    store().tapCell(0, 0);
    useCircuitEditorStore.setState({ future: [{ qubitCount: 2, gates: [] }] });
    store().redo();
    expect(store().selectedId).toBeNull();
  });

  it('keeps a selection whose gate survives undo', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0)] });
    store().arm('X');
    store().tapCell(1, 0);
    store().arm(null);
    store().tapCell(0, 0);
    store().undo();
    expect(store().selectedId).toBe('a');
  });

  it('clears a pending control on undo and redo', () => {
    store().arm('H');
    store().tapCell(0, 0);
    store().arm('CX');
    store().tapCell(1, 1);
    store().undo();
    expect(store().pendingControl).toBeNull();
    store().tapCell(1, 1);
    store().redo();
    expect(store().pendingControl).toBeNull();
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    store().arm('H');
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) store().tapCell(i % 2, Math.floor(i / 2));
    expect(store().past).toHaveLength(HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) store().undo();
    expect(store().gates).toHaveLength(5);
    expect(store().future).toHaveLength(HISTORY_LIMIT);
  });

  it('no-op and invalid ops do not push history', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0), { id: 'r', type: 'RX', qubit: 1, column: 0, params: { theta: 1 } }] });
    store().moveGate('a', 0, 0); // same cell
    store().moveGate('a', 1, 0); // onto another gate
    store().moveGate('missing', 0, 1);
    store().updateParams('r', { theta: 1 }); // unchanged
    store().updateParams('a', { theta: 1 }); // not parametric
    store().swapControlTarget('a'); // not two-qubit
    store().setQubitCount(2); // unchanged
    store().clear();
    useCircuitEditorStore.setState({ gates: [] });
    store().clear(); // already empty
    store().arm('H');
    store().tapCell(0, 40); // past the column bound
    expect(store().past).toHaveLength(1); // only the first clear
  });
});

describe('loading', () => {
  const bell: CircuitSpec = {
    qubits: 2,
    classical_bits: 2,
    gates: [
      { type: 'H', targets: [0] },
      { type: 'CNOT', control: 0, targets: [1] },
    ],
  };

  it('replaces the circuit, resets interaction state and is undoable', () => {
    useCircuitEditorStore.setState({ qubitCount: 1, gates: [h('a', 0, 0)], selectedId: 'a', armed: 'X' });
    store().arm('CX');
    store().tapCell(0, 0);
    const result = store().loadSpec(bell, 'Lesson circuit');
    expect(result).toEqual({ ok: true, skipped: 0 });
    expect(store()).toMatchObject({
      qubitCount: 2,
      name: 'Lesson circuit',
      selectedId: null,
      armed: null,
      pendingControl: null,
    });
    expect(store().spec().gates).toEqual([
      { type: 'H', targets: [0] },
      { type: 'CX', control: 0, targets: [1] },
    ]);
    store().undo();
    expect(store()).toMatchObject({ qubitCount: 1, gates: [h('a', 0, 0)] });
  });

  it('reports gates the editor cannot represent', () => {
    const result = store().loadSpec(
      { ...bell, gates: [...bell.gates, { type: 'CCX', targets: [0] }, { type: 'X', targets: [9] }] },
      'x',
    );
    expect(result).toEqual({ ok: true, skipped: 2 });
    expect(store().gates).toHaveLength(2);
  });

  it('rejects circuits over the qubit limit with a friendly error, leaving the draft', () => {
    useCircuitEditorStore.setState({ gates: [h('a', 0, 0)] });
    const result = store().loadSpec({ qubits: 9, classical_bits: 9, gates: [] }, 'big');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/8 qubits/);
    expect(store()).toMatchObject({ gates: [h('a', 0, 0)], name: DEFAULT_NAME, past: [] });
  });

  it('rejects invalid specs', () => {
    expect(store().loadSpec({ qubits: 0, classical_bits: 0, gates: [] }, 'bad')).toEqual({
      ok: false,
      error: "This circuit can't be opened in the builder.",
    });
  });

  it('loads templates by id', () => {
    expect(store().loadTemplate('ghz')).toEqual({ ok: true, skipped: 0 });
    expect(store()).toMatchObject({ qubitCount: 3, name: 'GHZ state' });
    expect(store().gates).toHaveLength(6);
    expect(store().loadTemplate('nope').ok).toBe(false);
  });
});

describe('persistence', () => {
  it('persists only the draft', () => {
    useCircuitEditorStore.setState({
      gates: [h('a', 0, 0)],
      selectedId: 'a',
      armed: 'H',
      pendingControl: { qubit: 0, column: 0 },
      past: [{ qubitCount: 2, gates: [] }],
      future: [{ qubitCount: 2, gates: [] }],
    });
    const partialize = useCircuitEditorStore.persist.getOptions().partialize!;
    expect(partialize(store())).toEqual({ qubitCount: 2, gates: [h('a', 0, 0)], name: DEFAULT_NAME, shots: 1024 });
  });

  it('rehydrates a stored draft', async () => {
    await Storage.setItem(
      'qlearn.circuit-draft',
      JSON.stringify({
        state: { qubitCount: 3, gates: [h('a', 2, 1)], name: 'Mine', shots: 256 },
        version: 0,
      }),
    );
    await useCircuitEditorStore.persist.rehydrate();
    expect(store()).toMatchObject({ qubitCount: 3, gates: [h('a', 2, 1)], name: 'Mine', shots: 256 });
  });

  it('sanitizes a corrupt draft instead of crashing', async () => {
    await Storage.setItem(
      'qlearn.circuit-draft',
      JSON.stringify({
        state: {
          qubitCount: 99,
          gates: [
            h('ok', 0, 0),
            h('ok', 1, 0), // duplicate id
            { id: 'clash', type: 'X', qubit: 0, column: 0 }, // overlaps "ok"
            { id: 'bad-type', type: 'NOPE', qubit: 0, column: 1 },
            { id: 'far', type: 'H', qubit: 20, column: 0 },
            { id: 'cx-no-control', type: 'CX', qubit: 1, column: 2 },
            { id: 'cx', type: 'CX', qubit: 1, control: 0, column: 3 },
            { id: 'rx', type: 'RX', qubit: 2, column: 4, params: { theta: 'big' } },
            null,
            'junk',
          ],
          name: 42,
          shots: 3,
        },
        version: 0,
      }),
    );
    await useCircuitEditorStore.persist.rehydrate();
    expect(store()).toMatchObject({ qubitCount: 8, name: DEFAULT_NAME, shots: 1024 });
    expect(store().gates).toEqual([
      h('ok', 0, 0),
      { id: 'cx', type: 'CX', qubit: 1, control: 0, column: 3 },
      { id: 'rx', type: 'RX', qubit: 2, column: 4, params: { theta: Math.PI / 2 } },
    ]);
  });

  it('keeps finite saved params and defaults non-object drafts', () => {
    expect(
      sanitizeDraft({ qubitCount: 1, gates: [{ id: 'p', type: 'P', qubit: 0, column: 0, params: { theta: 0.5 } }] })
        .gates,
    ).toEqual([{ id: 'p', type: 'P', qubit: 0, column: 0, params: { theta: 0.5 } }]);
    expect(sanitizeDraft('garbage')).toEqual({ qubitCount: 2, gates: [], name: DEFAULT_NAME, shots: 1024 });
  });
});
