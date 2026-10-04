import { layoutCircuit } from '@/components/circuit/layout';
import type { CircuitSpec, GateSpec } from '@/types/contracts';

import { GATES, isGateType, isParametric, isTwoQubitGate, parseAngle } from './gates';
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

/**
 * Result of loading a spec. `skipped` counts spec gates the editor cannot
 * represent (unknown type, bad qubits, invalid angle, past the column bound).
 */
export type ImportResult =
  | { ok: true; circuit: EditorCircuit; skipped: number }
  | { ok: false; reason: 'too-many-qubits' | 'invalid' };

/**
 * Angles as the backend would run them: a missing angle is 0, not the editor's
 * π/2 placement default, so an imported circuit runs exactly as it did in the
 * lesson. Returns null when a present angle is invalid; undefined for fixed gates.
 */
function importParams(gate: GateSpec, type: GateType): Record<string, number> | null | undefined {
  const defs = GATES[type].params;
  if (defs.length === 0) return undefined;
  const raw = (gate.params ?? {}) as Record<string, unknown>;
  const params: Record<string, number> = {};
  for (const { key } of defs) {
    const angle = parseAngle(raw[key]);
    if (!angle.ok) return null;
    params[key] = angle.value;
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
  if (params === null) return [];
  const withParams = params ? { params } : {};
  const hasControl = gate.control !== undefined && gate.control !== null;

  if (isTwoQubitGate(type)) {
    // Accept both {control, targets:[t]} and the two-target form {targets:[a, b]}.
    const control = hasControl ? gate.control : targets.length === 2 ? targets[0] : undefined;
    const target = hasControl ? targets[0] : targets[1];
    if (!inRange(control) || !inRange(target) || control === target) return [];
    return [{ type, control, targets: [target], ...withParams }];
  }
  // The backend compiles any gate with a control as `op q[c],q[t]`, so a
  // "controlled H" is not an H the editor could show.
  if (hasControl) return [];
  if (type === 'M') {
    // The editor always measures qubit q into classical bit q.
    if (targets.length === 0 || !targets.every(inRange)) return [];
    if (gate.classical) {
      const classical = gate.classical;
      if (classical.length !== targets.length || classical.some((c, i) => c !== targets[i])) return [];
    }
    return targets.map((q) => ({ type, targets: [q] }));
  }
  if (targets.length !== 1 || !inRange(targets[0])) return [];
  return [{ type, targets: [targets[0]], ...withParams }];
}

/**
 * Load a spec (a lesson circuit, a template) into the editor. Columns are packed
 * with the read-only diagram's `layoutCircuit`, so the editor shows a lesson
 * circuit the way the lesson does. Fails when the qubit count is not a positive
 * integer or exceeds what the editor supports.
 */
export function fromCircuitSpec(spec: CircuitSpec, makeId: () => string): ImportResult {
  const qubitCount = spec.qubits;
  if (typeof qubitCount !== 'number' || !Number.isInteger(qubitCount) || qubitCount < 1) {
    return { ok: false, reason: 'invalid' };
  }
  if (qubitCount > MAX_QUBITS) return { ok: false, reason: 'too-many-qubits' };

  // One skip per spec gate, even when it was split into several measurements.
  const skippedSources = new Set<number>();
  const sourceOf = new Map<GateSpec, number>();
  const normalized: GateSpec[] = [];
  (Array.isArray(spec.gates) ? spec.gates : []).forEach((gate, index) => {
    const parts = normalizeGate(gate, qubitCount);
    if (parts.length === 0) skippedSources.add(index);
    for (const part of parts) {
      sourceOf.set(part, index);
      normalized.push(part);
    }
  });

  const gates: EditorGate[] = [];
  for (const placed of layoutCircuit({ qubits: qubitCount, gates: normalized }).gates) {
    if (placed.column >= MAX_COLUMNS) {
      skippedSources.add(sourceOf.get(placed.gate) ?? -1);
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
  return { ok: true, circuit: { qubitCount, gates }, skipped: skippedSources.size };
}
