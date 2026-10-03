import type { CircuitSpec, GateSpec } from '@/types/contracts';

/**
 * CircuitSpec → illustrative Qiskit source. A port of the web's
 * `circuitSpecToQiskitSource` (frontend/src/lib/circuit-spec.ts): it is the
 * format the backend tutor prompt expects for `circuit_context`. Pure and
 * deterministic.
 */

const QISKIT_METHOD: Record<string, string> = {
  H: 'h', X: 'x', Y: 'y', Z: 'z', S: 's', T: 't', I: 'id',
  RX: 'rx', RY: 'ry', RZ: 'rz', U: 'u', U3: 'u', P: 'p', SX: 'sx',
  CX: 'cx', CNOT: 'cx', CZ: 'cz', SWAP: 'swap', RXX: 'rxx', RYY: 'ryy', RZZ: 'rzz',
};

/** Parameter order per gate (θ, φ, λ), mirroring frontend/src/lib/gates.ts. */
const PARAM_KEYS: Record<string, string[]> = {
  RX: ['theta'], RY: ['theta'], RZ: ['theta'], P: ['theta'],
  RXX: ['theta'], RYY: ['theta'], RZZ: ['theta'],
  U: ['theta', 'phi', 'lambda'], U3: ['theta', 'phi', 'lambda'],
};

function paramValues(gate: GateSpec): number[] {
  const params = (gate.params ?? {}) as Record<string, unknown>;
  return (PARAM_KEYS[gate.type.toUpperCase()] ?? []).map((key) => {
    const v = params[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  });
}

function fmtNum(v: number): string {
  return Number.isInteger(v) ? v.toFixed(1) : String(Number(v.toPrecision(12)));
}

export function circuitSpecToQiskitSource(spec: CircuitSpec): string {
  const lines = [
    'from qiskit import QuantumCircuit',
    'from qiskit_aer import AerSimulator',
    '',
    `qc = QuantumCircuit(${spec.qubits}, ${spec.classical_bits})`,
  ];
  const measureTargets: number[] = [];

  for (const gate of spec.gates) {
    const type = gate.type.toUpperCase();
    if (type === 'M') {
      measureTargets.push(...gate.targets);
      continue;
    }
    const method = QISKIT_METHOD[type];
    if (!method) continue;
    const target = gate.targets[0];
    const qubits = gate.control !== undefined && gate.control !== null ? [gate.control, target] : [target];
    lines.push(`qc.${method}(${[...paramValues(gate).map(fmtNum), ...qubits].join(', ')})`);
  }

  if (measureTargets.length > 0) {
    lines.push(`qc.measure(${JSON.stringify(measureTargets)}, ${JSON.stringify(measureTargets)})`);
  }
  return lines.join('\n');
}
