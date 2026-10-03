import type { CircuitSpec } from '@/types/contracts';

import { GATES, isGateType, isTwoQubitGate, parseAngle } from './gates';
import { MAX_QUBITS } from './types';

/**
 * Pre-flight check before `POST /execute`. It mirrors the backend's
 * `QiskitAerAdapter.validate` (same messages, so a learner sees the same text
 * either way) and adds the rules the backend leaves to Qiskit to fail on:
 * the editor's qubit bound, whole-number qubit indices, known gate types,
 * one target per single-qubit gate and a valid, distinct control.
 * An empty list means the circuit can run.
 */

const isWhole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

export function validateCircuit(spec: CircuitSpec): string[] {
  const errors: string[] = [];
  const qubits = spec.qubits;
  if (!isWhole(qubits)) {
    errors.push('Circuit qubit count must be a whole number');
  } else {
    if (qubits < 1) errors.push('Circuit must have at least 1 qubit');
    if (qubits > MAX_QUBITS) errors.push(`Maximum ${MAX_QUBITS} qubits supported`);
  }
  // Range checks only mean something against a valid qubit count.
  const outOfRange = (q: number) => isWhole(qubits) && (q < 0 || q >= qubits);

  if (!Array.isArray(spec.gates)) {
    errors.push('Circuit gates must be a list');
    return errors;
  }

  for (const gate of spec.gates) {
    // Canonical upper-case types only. The backend would lower-case an unknown
    // type into QASM, so 'h' might even run, but the editor never emits it and
    // 'CNOT' would not compile at all.
    if (!isGateType(gate.type)) {
      errors.push(`Unknown gate type '${gate.type}'`);
      continue;
    }
    const type = gate.type;
    if (!Array.isArray(gate.targets)) {
      errors.push(`${type}: targets must be a list of qubits`);
      continue;
    }
    if (gate.targets.length === 0) errors.push(`${type}: gate needs a target qubit`);
    if (gate.targets.length > 1 && !isTwoQubitGate(type) && type !== 'M') {
      errors.push(`${type}: expects exactly one target qubit`);
    }
    for (const t of gate.targets) {
      if (!isWhole(t)) errors.push(`${type}: target ${String(t)} must be a whole number`);
      else if (outOfRange(t)) errors.push(`Gate target ${t} out of range for ${qubits} qubits`);
    }
    if (isTwoQubitGate(type)) {
      const control = gate.control;
      if (control === undefined || control === null) {
        errors.push(`${type}: control qubit is required`);
      } else if (!isWhole(control)) {
        errors.push(`${type}: control qubit ${String(control)} must be a whole number`);
      } else if (outOfRange(control)) {
        errors.push(`${type}: control qubit ${control} out of range for ${qubits} qubits`);
      } else if (gate.targets.includes(control)) {
        errors.push(`${type}: control and target must be different qubits`);
      }
    }
    const params = (gate.params ?? {}) as Record<string, unknown>;
    for (const { key } of GATES[type].params) {
      const angle = parseAngle(params[key]);
      if (angle.ok) continue;
      const problem = angle.error === 'not-finite' ? 'must be finite' : 'must be a number';
      errors.push(`${type}: Gate parameter '${key}' ${problem}`);
    }
  }
  return errors;
}
