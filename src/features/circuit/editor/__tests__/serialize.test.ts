import type { CircuitSpec } from '@/types/contracts';

import { placeGate, placeTwoQubitGate } from '../model';
import { fromCircuitSpec, toCircuitSpec } from '../serialize';
import { TEMPLATES } from '../templates';
import type { EditorCircuit } from '../types';

function idMaker() {
  let n = 0;
  return () => `id${++n}`;
}

describe('toCircuitSpec', () => {
  it('serializes a Bell circuit exactly like the web', () => {
    const bell: EditorCircuit = {
      qubitCount: 2,
      // Deliberately out of order: the serializer sorts by (column, qubit).
      gates: [
        { id: 'm1', type: 'M', qubit: 1, column: 2 },
        { id: 'cx', type: 'CX', qubit: 1, control: 0, column: 1 },
        { id: 'm0', type: 'M', qubit: 0, column: 2 },
        { id: 'h', type: 'H', qubit: 0, column: 0 },
      ],
    };
    const expected: CircuitSpec = {
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'CX', control: 0, targets: [1] },
        { type: 'M', targets: [0], classical: [0] },
        { type: 'M', targets: [1], classical: [1] },
      ],
    };
    const spec = toCircuitSpec(bell);
    expect(spec).toEqual(expected);
    // Same key order as the web's object literals, so the JSON is byte-identical.
    expect(JSON.stringify(spec)).toBe(JSON.stringify(expected));
  });

  it('carries params only for parametric gates', () => {
    const c: EditorCircuit = {
      qubitCount: 2,
      gates: [
        { id: 'rx', type: 'RX', qubit: 0, column: 0, params: { theta: Math.PI / 4 } },
        { id: 'u', type: 'U', qubit: 1, column: 0, params: { theta: 1, phi: 2, lambda: 3 } },
        { id: 'rzz', type: 'RZZ', qubit: 1, control: 0, column: 1, params: { theta: -1 } },
        // Stray params on a fixed gate are never sent.
        { id: 'h', type: 'H', qubit: 0, column: 2, params: { theta: 9 } },
      ],
    };
    const expected: CircuitSpec = {
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'RX', targets: [0], params: { theta: Math.PI / 4 } },
        { type: 'U', targets: [1], params: { theta: 1, phi: 2, lambda: 3 } },
        { type: 'RZZ', control: 0, targets: [1], params: { theta: -1 } },
        { type: 'H', targets: [0] },
      ],
    };
    const spec = toCircuitSpec(c);
    expect(spec).toEqual(expected);
    expect(JSON.stringify(spec)).toBe(JSON.stringify(expected));
  });

  it('copies params so later edits cannot leak into a sent spec', () => {
    const params = { theta: 1 };
    const spec = toCircuitSpec({ qubitCount: 1, gates: [{ id: 'p', type: 'P', qubit: 0, column: 0, params }] });
    params.theta = 2;
    expect(spec.gates[0].params).toEqual({ theta: 1 });
  });

  it('serializes an empty circuit', () => {
    expect(toCircuitSpec({ qubitCount: 3, gates: [] })).toEqual({ qubits: 3, classical_bits: 3, gates: [] });
  });
});

/** Import a spec that must load. */
function load(spec: CircuitSpec) {
  const result = fromCircuitSpec(spec, idMaker());
  if (!result.ok) throw new Error(`expected the spec to load, got ${result.reason}`);
  return result;
}

describe('fromCircuitSpec', () => {
  it('imports a Bell circuit into packed columns', () => {
    expect(fromCircuitSpec(TEMPLATES.find((t) => t.id === 'bell')!.spec, idMaker())).toEqual({
      ok: true,
      skipped: 0,
      circuit: {
        qubitCount: 2,
        gates: [
          { id: 'id1', type: 'H', qubit: 0, column: 0 },
          { id: 'id2', type: 'CX', qubit: 1, control: 0, column: 1 },
          { id: 'id3', type: 'M', qubit: 0, column: 2 },
          { id: 'id4', type: 'M', qubit: 1, column: 2 },
        ],
      },
    });
  });

  it('normalizes CNOT and lower-case types', () => {
    const result = load({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'h', targets: [0] },
        { type: 'cnot', control: 0, targets: [1] },
        { type: 'CNOT', control: 1, targets: [0] },
      ],
    });
    expect(result.skipped).toBe(0);
    expect(result.circuit.gates.map((g) => [g.type, g.control, g.qubit])).toEqual([
      ['H', undefined, 0],
      ['CX', 0, 1],
      ['CX', 1, 0],
    ]);
  });

  it('accepts the two-target form for two-qubit gates', () => {
    const result = load({ qubits: 2, classical_bits: 2, gates: [{ type: 'SWAP', targets: [0, 1] }] });
    expect(result.circuit.gates[0]).toMatchObject({ type: 'SWAP', control: 0, qubit: 1 });
  });

  it('skips and counts unknown and out-of-range gates', () => {
    const result = load({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'CCX', control: 0, targets: [1] },
        { type: 'X', targets: [2] },
        { type: 'X', targets: [] },
        { type: 'X', targets: [0, 1] },
        { type: 'CX', control: 5, targets: [0] },
        { type: 'CX', control: 1, targets: [1] },
        { type: 'CX', targets: [1] },
        { type: 'Z', targets: [1] },
      ],
    });
    expect(result.skipped).toBe(7);
    expect(result.circuit.gates.map((g) => g.type)).toEqual(['H', 'Z']);
  });

  it('skips a single-qubit gate or measurement that carries a control', () => {
    // The backend would compile these as two-qubit ops (`x q[0],q[1]`), not as an X.
    const result = load({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'X', control: 0, targets: [1] },
        { type: 'M', control: 0, targets: [1] },
      ],
    });
    expect(result).toEqual({ ok: true, skipped: 2, circuit: { qubitCount: 2, gates: [] } });
  });

  it('defaults a missing angle to 0, as the backend runs it', () => {
    const result = load({
      qubits: 1,
      classical_bits: 1,
      gates: [
        { type: 'RX', targets: [0] },
        { type: 'U', targets: [0], params: { theta: 1 } },
        { type: 'P', targets: [0], params: { theta: '0.5' } },
        { type: 'H', targets: [0], params: { theta: 3 } },
      ],
    });
    expect(result.skipped).toBe(0);
    expect(result.circuit.gates.map((g) => g.params)).toEqual([
      { theta: 0 },
      { theta: 1, phi: 0, lambda: 0 },
      { theta: 0.5 },
      undefined,
    ]);
  });

  it('skips and counts gates with an invalid angle instead of substituting one', () => {
    const result = load({
      qubits: 1,
      classical_bits: 1,
      gates: [
        { type: 'U', targets: [0], params: { theta: 1, phi: 'x' } },
        { type: 'RX', targets: [0], params: { theta: Infinity } },
        { type: 'RY', targets: [0], params: { theta: NaN } },
        { type: 'RZ', targets: [0], params: { theta: true } },
        { type: 'RZ', targets: [0], params: { theta: null } },
        { type: 'RX', targets: [0], params: { theta: 2 } },
      ],
    });
    expect(result.skipped).toBe(5);
    expect(result.circuit.gates.map((g) => g.params)).toEqual([{ theta: 2 }]);
  });

  it('splits a multi-target measurement into one M per qubit', () => {
    const result = load({ qubits: 2, classical_bits: 2, gates: [{ type: 'M', targets: [0, 1], classical: [0, 1] }] });
    expect(result.skipped).toBe(0);
    expect(result.circuit.gates.map((g) => [g.type, g.qubit, g.column])).toEqual([
      ['M', 0, 0],
      ['M', 1, 0],
    ]);
  });

  it('skips a measurement into a different classical bit or with mismatched lengths', () => {
    const result = load({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'M', targets: [0], classical: [1] },
        { type: 'M', targets: [0, 1], classical: [0] },
        { type: 'M', targets: [0], classical: [0, 1] },
      ],
    });
    expect(result).toEqual({ ok: true, skipped: 3, circuit: { qubitCount: 2, gates: [] } });
  });

  it('skips gates that would land past MAX_COLUMNS', () => {
    const gates = Array.from({ length: 45 }, () => ({ type: 'X', targets: [0] }));
    const result = load({ qubits: 2, classical_bits: 2, gates: [...gates, { type: 'H', targets: [1] }] });
    expect(result.skipped).toBe(5);
    expect(result.circuit.gates).toHaveLength(41);
    expect(Math.max(...result.circuit.gates.map((g) => g.column))).toBe(39);
  });

  it('counts one skip per spec gate when a split measurement lands past MAX_COLUMNS', () => {
    const filler = Array.from({ length: 40 }, () => ({ type: 'CX', control: 0, targets: [1] }));
    const result = load({
      qubits: 2,
      classical_bits: 2,
      gates: [...filler, { type: 'M', targets: [0, 1], classical: [0, 1] }],
    });
    expect(result.skipped).toBe(1);
    expect(result.circuit.gates).toHaveLength(40);
  });

  it('rejects specs with more than 8 qubits', () => {
    expect(fromCircuitSpec({ qubits: 9, classical_bits: 9, gates: [] }, idMaker())).toEqual({
      ok: false,
      reason: 'too-many-qubits',
    });
    expect(load({ qubits: 8, classical_bits: 8, gates: [] }).circuit.qubitCount).toBe(8);
  });

  it('rejects a missing, non-integer or non-positive qubit count as invalid', () => {
    for (const qubits of [0, -1, 1.5, NaN, undefined, '2']) {
      const spec = { qubits, classical_bits: 1, gates: [] } as unknown as CircuitSpec;
      expect(fromCircuitSpec(spec, idMaker())).toEqual({ ok: false, reason: 'invalid' });
    }
  });
});

describe('round trip', () => {
  function build(): EditorCircuit {
    let c: EditorCircuit | null = { qubitCount: 3, gates: [] };
    c = placeGate(c, 'H', 0, 0, 'a');
    c = placeGate(c!, 'RY', 2, 0, 'b');
    c = placeTwoQubitGate(c!, 'CX', 0, 1, 1, 'c');
    c = placeTwoQubitGate(c!, 'RZZ', 2, 0, 2, 'd');
    c = placeGate(c!, 'M', 0, 3, 'e');
    c = placeGate(c!, 'M', 1, 3, 'f');
    c = placeGate(c!, 'M', 2, 3, 'g');
    return c!;
  }

  it('keeps the spec equal for a packed circuit', () => {
    const spec = toCircuitSpec(build());
    const back = load(spec);
    expect(back.skipped).toBe(0);
    expect(toCircuitSpec(back.circuit)).toEqual(spec);
  });

  it('keeps the same gates for every template (GHZ measures q0 earlier once packed)', () => {
    const key = (g: object) => JSON.stringify(g);
    for (const template of TEMPLATES) {
      const back = toCircuitSpec(load(template.spec).circuit);
      expect(back.gates.map(key).sort()).toEqual(template.spec.gates.map(key).sort());
      expect(toCircuitSpec(load(back).circuit)).toEqual(back);
    }
    expect(toCircuitSpec(load(TEMPLATES[1].spec).circuit)).toEqual(TEMPLATES[1].spec);
  });

  it('compacts gaps once, then stays stable, preserving gate order per qubit', () => {
    const gappy: EditorCircuit = {
      qubitCount: 2,
      gates: [
        { id: 'a', type: 'H', qubit: 1, column: 0 },
        { id: 'b', type: 'X', qubit: 0, column: 5 },
        { id: 'c', type: 'Z', qubit: 0, column: 7 },
      ],
    };
    const once = toCircuitSpec(load(toCircuitSpec(gappy)).circuit);
    const twice = toCircuitSpec(load(once).circuit);
    expect(twice).toEqual(once);
    expect(once.gates.filter((g) => g.targets[0] === 0).map((g) => g.type)).toEqual(['X', 'Z']);
  });
});
