import { layoutCircuit } from '@/components/circuit/layout';
import type { CircuitSpec, GateSpec } from '@/types/contracts';

import { defaultParams, GATES, isGateType, isParametric, isTwoQubitGate } from './gates';
import { MAX_COLUMNS, MAX_QUBITS, type EditorCircuit, type EditorGate, type GateParams, type GateType } from './types';

/**
 * Editor model ⇄ canonical `CircuitSpec`. `toCircuitSpec` is a port of the
 * web's `nodesToCircuitSpec` (frontend/src/lib/circuit-spec.ts), key for key,
 * so the backend cannot tell which client built a circuit.
 */

export function toCircuitSpec(circuit: EditorCircuit): CircuitSpec {
  const sorted = [...circuit.gates].sort((a, b) => a.column - b.column || a.qubit - b.qubit);
  const gates: GateSpec[] = sorted.map((g) => {
    if (g.type === 'M') return { type: 'M', targets: [g.qubit], classical: [g.qubit] };
    const params = g.params && isParametric(g.type) ? { params: { ...g.params } } : {};
    if (isTwoQubitGate(g.type)) return { type: g.type, control: g.control, targets: [g.qubit], ...params };
    return { type: g.type, targets: [g.qubit], ...params };
  });
  return { qubits: circuit.qubitCount, classical_bits: circuit.qubitCount, gates };
}

export interface ImportedCircuit {
  circuit: EditorCircuit;
  /** Gates the editor cannot represent (unknown type, bad qubits, past the column bound). */
  skipped: number;
}

/** Defaults overlaid with whatever finite angles the spec supplies. */
function importParams(gate: GateSpec, type: GateType): Record<string, number> | undefined {
  const defaults = defaultParams(type);
  if (!defaults) return undefined;
  const params: Record<string, number> = { ...defaults };
  const raw = (gate.params ?? {}) as Record<string, unknown>;
  for (const { key } of GATES[type].params) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) params[key] = v;
  }
  return params;
}

/**
 * Normalize one spec gate into editor-shaped specs (one target each), or [] when
 * the editor cannot represent it. A multi-target M becomes one M per qubit.
 */
function normalizeGate(gate: GateSpec, qubits: number): GateSpec[] {
  const upper = typeof gate.type === 'string' ? gate.type.toUpperCase() : '';
  const type = upper === 'CNOT' ? 'CX' : upper;
  if (!isGateType(type)) return [];
  const inRange = (q: unknown): q is number => typeof q === 'number' && Number.isInteger(q) && q >= 0 && q < qubits;
  const targets = Array.isArray(gate.targets) ? gate.targets : [];
  const params = importParams(gate, type);
  const withParams = params ? { params } : {};

  if (isTwoQubitGate(type)) {
    // Accept both {control, targets:[t]} and the two-target form {targets:[a, b]}.
    const control = gate.control ?? (targets.length === 2 ? targets[0] : undefined);
    const target = gate.control !== undefined && gate.control !== null ? targets[0] : targets[1];
    if (!inRange(control) || !inRange(target) || control === target) return [];
    return [{ type, control, targets: [target], ...withParams }];
  }
  if (type === 'M') {
    // The editor always measures qubit q into classical bit q.
    if (targets.length === 0 || !targets.every(inRange)) return [];
    if (gate.classical && gate.classical.some((c, i) => c !== targets[i])) return [];
    return targets.map((q) => ({ type, targets: [q] }));
  }
  if (targets.length !== 1 || !inRange(targets[0])) return [];
  return [{ type, targets: [targets[0]], ...withParams }];
}

/**
 * Load a spec (a lesson circuit, a template) into the editor. Columns are packed
 * with the read-only diagram's `layoutCircuit`, so the editor shows a lesson
 * circuit the way the lesson does. Returns null when the spec has more qubits
 * than the editor supports.
 */
export function fromCircuitSpec(spec: CircuitSpec, makeId: () => string): ImportedCircuit | null {
  const raw = Number(spec.qubits);
  if (!Number.isFinite(raw) || raw > MAX_QUBITS) return null;
  const qubitCount = Math.max(1, Math.floor(raw));
  let skipped = 0;
  const normalized: GateSpec[] = [];
  for (const gate of spec.gates ?? []) {
    const parts = normalizeGate(gate, qubitCount);
    if (parts.length === 0) skipped++;
    normalized.push(...parts);
  }

  const gates: EditorGate[] = [];
  for (const placed of layoutCircuit({ qubits: qubitCount, gates: normalized }).gates) {
    if (placed.column >= MAX_COLUMNS) {
      skipped++;
      continue;
    }
    const { type, params } = placed.gate as { type: GateType; params?: GateParams };
    gates.push({
      id: makeId(),
      type,
      column: placed.column,
      qubit: placed.targets[0],
      ...(placed.control !== null ? { control: placed.control } : {}),
      ...(params ? { params } : {}),
    });
  }
  return { circuit: { qubitCount, gates }, skipped };
}
