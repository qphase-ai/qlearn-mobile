import type { CircuitSpec, GateSpec } from '@/types/contracts';

import { TEMPLATES } from '../templates';
import { validateCircuit } from '../validate';

const spec = (gates: GateSpec[], qubits = 2): CircuitSpec => ({ qubits, classical_bits: qubits, gates });

describe('validateCircuit', () => {
  it('accepts every template', () => {
    for (const template of TEMPLATES) expect(validateCircuit(template.spec)).toEqual([]);
  });

  it('accepts an empty circuit', () => {
    expect(validateCircuit(spec([]))).toEqual([]);
  });

  it('bounds the qubit count', () => {
    expect(validateCircuit(spec([], 0))).toEqual(['Circuit must have at least 1 qubit']);
    expect(validateCircuit(spec([], 9))).toEqual(['Maximum 8 qubits supported']);
  });

  it('uses the backend message for out-of-range targets', () => {
    expect(validateCircuit(spec([{ type: 'H', targets: [2] }]))).toEqual(['Gate target 2 out of range for 2 qubits']);
    expect(validateCircuit(spec([{ type: 'H', targets: [-1] }]))).toEqual(['Gate target -1 out of range for 2 qubits']);
  });

  it('requires a target', () => {
    expect(validateCircuit(spec([{ type: 'X', targets: [] }]))).toEqual(['X: gate needs a target qubit']);
  });

  it('rejects unknown types, including case and the CNOT alias the backend does not map', () => {
    expect(validateCircuit(spec([{ type: 'CCX', targets: [0] }, { type: 'CNOT', control: 0, targets: [1] }, { type: 'h', targets: [0] }]))).toEqual([
      "Unknown gate type 'CCX'",
      "Unknown gate type 'CNOT'",
      "Unknown gate type 'h'",
    ]);
  });

  it('checks the control of two-qubit gates', () => {
    expect(validateCircuit(spec([{ type: 'CX', targets: [1] }]))).toEqual(['CX: control qubit is required']);
    expect(validateCircuit(spec([{ type: 'CZ', control: 3, targets: [1] }]))).toEqual([
      'CZ: control qubit 3 out of range for 2 qubits',
    ]);
    expect(validateCircuit(spec([{ type: 'SWAP', control: 1, targets: [1] }]))).toEqual([
      'SWAP: control and target must be different qubits',
    ]);
  });

  it('mirrors the backend angle rules', () => {
    expect(validateCircuit(spec([{ type: 'RX', targets: [0] }]))).toEqual([]);
    expect(validateCircuit(spec([{ type: 'RX', targets: [0], params: { theta: '1.5' } }]))).toEqual([]);
    expect(validateCircuit(spec([{ type: 'RX', targets: [0], params: { theta: Infinity } }]))).toEqual([
      "RX: Gate parameter 'theta' must be finite",
    ]);
    expect(
      validateCircuit(spec([{ type: 'U', targets: [0], params: { theta: true, phi: 'abc', lambda: null } }])),
    ).toEqual([
      "U: Gate parameter 'theta' must be a number",
      "U: Gate parameter 'phi' must be a number",
      "U: Gate parameter 'lambda' must be a number",
    ]);
    expect(validateCircuit(spec([{ type: 'RYY', control: 0, targets: [1], params: { theta: NaN } }]))).toEqual([
      "RYY: Gate parameter 'theta' must be a number",
    ]);
  });

  it('reports a gate without a targets list instead of throwing', () => {
    const bad = { type: 'H' } as unknown as GateSpec;
    expect(validateCircuit(spec([bad]))).toEqual(['H: targets must be a list of qubits']);
  });

  it('reports a missing gates list instead of throwing', () => {
    expect(validateCircuit({ qubits: 1, classical_bits: 1 } as unknown as CircuitSpec)).toEqual([
      'Circuit gates must be a list',
    ]);
  });

  it('requires whole-number qubit counts and indices', () => {
    expect(validateCircuit(spec([], 1.5))).toEqual(['Circuit qubit count must be a whole number']);
    expect(validateCircuit(spec([{ type: 'H', targets: [0.5] }]))).toEqual(['H: target 0.5 must be a whole number']);
    expect(validateCircuit(spec([{ type: 'CX', control: 0.5, targets: [1] }]))).toEqual([
      'CX: control qubit 0.5 must be a whole number',
    ]);
  });

  it('allows one target per single-qubit gate, but several for M', () => {
    expect(validateCircuit(spec([{ type: 'H', targets: [0, 1] }]))).toEqual(['H: expects exactly one target qubit']);
    expect(validateCircuit(spec([{ type: 'M', targets: [0, 1], classical: [0, 1] }]))).toEqual([]);
  });

  it('ignores params on fixed gates', () => {
    expect(validateCircuit(spec([{ type: 'H', targets: [0], params: { theta: 'bad' } }]))).toEqual([]);
  });

  it('collects every error', () => {
    expect(validateCircuit(spec([{ type: 'X', targets: [5] }, { type: 'CX', control: 0, targets: [0] }]))).toHaveLength(2);
  });
});
