import type { CircuitSpec } from '@/types/contracts';

import { GATES, isGateType, isTwoQubitGate } from './gates';
import { MAX_QUBITS } from './types';

/**
 * Pre-flight check before `POST /execute`. It mirrors the backend's
 * `QiskitAerAdapter.validate` (same messages, so a learner sees the same text
 * either way) and adds the rules the backend leaves to Qiskit to fail on:
 * the editor's qubit bound, known gate types and a valid, distinct control.
 * An empty list means the circuit can run.
 */

/** Backend `_angle`: a missing angle is 0; anything present must be a finite number. */
function angleError(raw: unknown, key: string): string | null {
  if (raw === undefined) return null;
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (Number.isNaN(value)) return `Gate parameter '${key}' must be a number`;
  if (!Number.isFinite(value)) return `Gate parameter '${key}' must be finite`;
  return null;
}

export function validateCircuit(spec: CircuitSpec): string[] {
  const errors: string[] = [];
  const qubits = spec.qubits;
  if (!(qubits >= 1)) errors.push('Circuit must have at least 1 qubit');
  if (qubits > MAX_QUBITS) errors.push(`Maximum ${MAX_QUBITS} qubits supported`);

  for (const gate of spec.gates) {
    // The backend matches types case-sensitively, so 'CNOT' or 'h' would not run.
    if (!isGateType(gate.type)) {
      errors.push(`Unknown gate type '${gate.type}'`);
      continue;
    }
    const type = gate.type;
    if (gate.targets.length === 0) errors.push(`${type}: gate needs a target qubit`);
    for (const t of gate.targets) {
      if (t >= qubits || t < 0) errors.push(`Gate target ${t} out of range for ${qubits} qubits`);
    }
    if (isTwoQubitGate(type)) {
      const control = gate.control;
      if (control === undefined || control === null) {
        errors.push(`${type}: control qubit is required`);
      } else if (control < 0 || control >= qubits) {
        errors.push(`${type}: control qubit ${control} out of range for ${qubits} qubits`);
      } else if (gate.targets.includes(control)) {
        errors.push(`${type}: control and target must be different qubits`);
      }
    }
    const params = (gate.params ?? {}) as Record<string, unknown>;
    for (const { key } of GATES[type].params) {
      const error = angleError(params[key], key);
      if (error) errors.push(`${type}: ${error}`);
    }
  }
  return errors;
}
