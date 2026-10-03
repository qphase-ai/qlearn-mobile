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

describe('fromCircuitSpec', () => {
  it('imports a Bell circuit into packed columns', () => {
    const result = fromCircuitSpec(TEMPLATES.find((t) => t.id === 'bell')!.spec, idMaker());
    expect(result).toEqual({
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
    const result = fromCircuitSpec(
      {
        qubits: 2,
        classical_bits: 2,
        gates: [
          { type: 'h', targets: [0] },
          { type: 'cnot', control: 0, targets: [1] },
          { type: 'CNOT', control: 1, targets: [0] },
        ],
      },
      idMaker(),
    );
    expect(result?.skipped).toBe(0);
    expect(result?.circuit.gates.map((g) => [g.type, g.control, g.qubit])).toEqual([
      ['H', undefined, 0],
      ['CX', 0, 1],
      ['CX', 1, 0],
    ]);
  });

  it('accepts the two-target form for two-qubit gates', () => {
    const result = fromCircuitSpec({ qubits: 2, classical_bits: 2, gates: [{ type: 'SWAP', targets: [0, 1] }] }, idMaker());
    expect(result?.circuit.gates[0]).toMatchObject({ type: 'SWAP', control: 0, qubit: 1 });
  });

  it('skips and counts unknown and out-of-range gates', () => {
    const result = fromCircuitSpec(
      {
        qubits: 2,
        classical_bits: 2,
        gates: [
          { type: 'H', targets: [0] },
          { type: 'CCX', control: 0, targets: [1] },
          { type: 'X', targets: [2] },
          { type: 'X', targets: [] },
          { type: 'CX', control: 5, targets: [0] },
          { type: 'CX', control: 1, targets: [1] },
          { type: 'CX', targets: [1] },
          { type: 'Z', targets: [1] },
        ],
      },
      idMaker(),
    );
    expect(result?.skipped).toBe(6);
    expect(result?.circuit.gates.map((g) => g.type)).toEqual(['H', 'Z']);
  });

  it('fills defaults and keeps finite spec params', () => {
    const result = fromCircuitSpec(
      {
        qubits: 1,
        classical_bits: 1,
        gates: [
          { type: 'U', targets: [0], params: { theta: 1, phi: 'x', lambda: Infinity } },
          { type: 'RX', targets: [0] },
          { type: 'H', targets: [0], params: { theta: 3 } },
        ],
      },
      idMaker(),
    );
    expect(result?.circuit.gates.map((g) => g.params)).toEqual([
      { theta: 1, phi: 0, lambda: 0 },
      { theta: Math.PI / 2 },
      undefined,
    ]);
  });

  it('splits a multi-target measurement into one M per qubit', () => {
    const result = fromCircuitSpec(
      { qubits: 2, classical_bits: 2, gates: [{ type: 'M', targets: [0, 1], classical: [0, 1] }] },
      idMaker(),
    );
    expect(result?.skipped).toBe(0);
    expect(result?.circuit.gates.map((g) => [g.type, g.qubit, g.column])).toEqual([
      ['M', 0, 0],
      ['M', 1, 0],
    ]);
  });

  it('skips a measurement into a different classical bit (the editor cannot represent it)', () => {
    const result = fromCircuitSpec(
      { qubits: 2, classical_bits: 2, gates: [{ type: 'M', targets: [0], classical: [1] }] },
      idMaker(),
    );
    expect(result).toEqual({ skipped: 1, circuit: { qubitCount: 2, gates: [] } });
  });

  it('skips gates that would land past MAX_COLUMNS', () => {
    const gates = Array.from({ length: 45 }, () => ({ type: 'X', targets: [0] }));
    const result = fromCircuitSpec({ qubits: 2, classical_bits: 2, gates: [...gates, { type: 'H', targets: [1] }] }, idMaker());
    expect(result?.skipped).toBe(5);
    expect(result?.circuit.gates).toHaveLength(41);
    expect(Math.max(...result!.circuit.gates.map((g) => g.column))).toBe(39);
  });

  it('rejects specs with more than 8 qubits', () => {
    expect(fromCircuitSpec({ qubits: 9, classical_bits: 9, gates: [] }, idMaker())).toBeNull();
    expect(fromCircuitSpec({ qubits: 8, classical_bits: 8, gates: [] }, idMaker())?.circuit.qubitCount).toBe(8);
  });

  it('clamps a zero-qubit spec to one qubit', () => {
    expect(fromCircuitSpec({ qubits: 0, classical_bits: 0, gates: [] }, idMaker())?.circuit.qubitCount).toBe(1);
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
    const back = fromCircuitSpec(spec, idMaker());
    expect(back?.skipped).toBe(0);
    expect(toCircuitSpec(back!.circuit)).toEqual(spec);
  });

  it('keeps the same gates for every template (GHZ measures q0 earlier once packed)', () => {
    const key = (g: object) => JSON.stringify(g);
    for (const template of TEMPLATES) {
      const back = toCircuitSpec(fromCircuitSpec(template.spec, idMaker())!.circuit);
      expect(back.gates.map(key).sort()).toEqual(template.spec.gates.map(key).sort());
      expect(toCircuitSpec(fromCircuitSpec(back, idMaker())!.circuit)).toEqual(back);
    }
    expect(toCircuitSpec(fromCircuitSpec(TEMPLATES[1].spec, idMaker())!.circuit)).toEqual(TEMPLATES[1].spec);
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
    const once = toCircuitSpec(fromCircuitSpec(toCircuitSpec(gappy), idMaker())!.circuit);
    const twice = toCircuitSpec(fromCircuitSpec(once, idMaker())!.circuit);
    expect(twice).toEqual(once);
    expect(once.gates.filter((g) => g.targets[0] === 0).map((g) => g.type)).toEqual(['X', 'Z']);
  });
});
