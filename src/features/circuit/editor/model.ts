import { defaultParams, GATES, isTwoQubitGate } from './gates';
import {
  MAX_COLUMNS,
  MAX_QUBITS,
  MIN_QUBITS,
  type EditorCircuit,
  type EditorGate,
  type GateParams,
  type GateType,
} from './types';

/**
 * Immutable editor operations, ported from the web's `circuitStore` placement
 * rules. Each op returns a new circuit, `null` when the op is invalid, or the
 * same circuit object when it changes nothing, so the store can tell a no-op
 * (no history entry) from a real edit by identity. Ids are passed in to keep
 * this module deterministic.
 */

const cellKey = (qubit: number, column: number) => `${qubit}:${column}`;

const isIndex = (n: number, size: number) => Number.isInteger(n) && n >= 0 && n < size;

/** Every row a gate covers: a two-qubit gate also blocks the rows between its qubits. */
export function gateRows(gate: Pick<EditorGate, 'qubit' | 'control'>): number[] {
  if (gate.control === undefined) return [gate.qubit];
  const lo = Math.min(gate.qubit, gate.control);
  const hi = Math.max(gate.qubit, gate.control);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
}

/** "qubit:column" keys covered by gates, optionally ignoring some gate ids. */
export function occupied(circuit: EditorCircuit, ignoreIds: ReadonlySet<string> = new Set()): Set<string> {
  const cells = new Set<string>();
  for (const gate of circuit.gates) {
    if (ignoreIds.has(gate.id)) continue;
    for (const q of gateRows(gate)) cells.add(cellKey(q, gate.column));
  }
  return cells;
}

/** First column ≥ `from` where every row in `rows` is free. */
export function nextFreeColumn(cells: ReadonlySet<string>, rows: number[], from = 0): number {
  let column = Math.max(0, from);
  while (rows.some((q) => cells.has(cellKey(q, column)))) column++;
  return column;
}

function insert(circuit: EditorCircuit, gate: EditorGate): EditorCircuit | null {
  // Ids address gates in every other op, so a duplicate would make them ambiguous.
  if (circuit.gates.some((g) => g.id === gate.id)) return null;
  if (!isIndex(gate.column, MAX_COLUMNS)) return null;
  const rows = gateRows(gate);
  if (!rows.every((q) => isIndex(q, circuit.qubitCount))) return null;
  // An occupied cell pushes the gate right, like dropping onto a taken cell on the web.
  const column = nextFreeColumn(occupied(circuit), rows, gate.column);
  if (column >= MAX_COLUMNS) return null;
  return { ...circuit, gates: [...circuit.gates, { ...gate, column }] };
}

function withDefaults(type: GateType): Pick<EditorGate, 'params'> {
  const params = defaultParams(type);
  return params ? { params } : {};
}

/** Place a single-qubit gate (or M) at the cell, or the next free column on that row. */
export function placeGate(
  circuit: EditorCircuit,
  type: GateType,
  qubit: number,
  column: number,
  id: string,
): EditorCircuit | null {
  if (isTwoQubitGate(type)) return null;
  return insert(circuit, { id, type, qubit, column, ...withDefaults(type) });
}

/** Place a two-qubit gate in the first free column covering every spanned row. */
export function placeTwoQubitGate(
  circuit: EditorCircuit,
  type: GateType,
  control: number,
  target: number,
  column: number,
  id: string,
): EditorCircuit | null {
  if (!isTwoQubitGate(type) || control === target) return null;
  return insert(circuit, { id, type, qubit: target, control, column, ...withDefaults(type) });
}

function replaceGate(circuit: EditorCircuit, next: EditorGate): EditorCircuit {
  return { ...circuit, gates: circuit.gates.map((g) => (g.id === next.id ? next : g)) };
}

/**
 * Move a gate's target to (qubit, column); the control keeps its offset. Unlike
 * placement there is no shifting: a drop onto another gate is rejected.
 */
export function moveGate(circuit: EditorCircuit, id: string, qubit: number, column: number): EditorCircuit | null {
  const gate = circuit.gates.find((g) => g.id === id);
  if (!gate) return null;
  if (gate.qubit === qubit && gate.column === column) return circuit;
  const next: EditorGate = {
    ...gate,
    qubit,
    column,
    ...(gate.control !== undefined ? { control: gate.control + (qubit - gate.qubit) } : {}),
  };
  if (!isIndex(column, MAX_COLUMNS)) return null;
  const rows = gateRows(next);
  if (!rows.every((q) => isIndex(q, circuit.qubitCount))) return null;
  const blocked = occupied(circuit, new Set([id]));
  if (rows.some((q) => blocked.has(cellKey(q, column)))) return null;
  return replaceGate(circuit, next);
}

/** Merge finite angles into a parametric gate's params; unknown keys are ignored. */
export function updateParams(circuit: EditorCircuit, id: string, params: GateParams): EditorCircuit | null {
  const gate = circuit.gates.find((g) => g.id === id);
  if (!gate) return null;
  const defs = GATES[gate.type].params;
  if (defs.length === 0) return null;
  const merged: GateParams = { ...defaultParams(gate.type), ...gate.params };
  let changed = false;
  for (const { key } of defs) {
    const value = params[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || merged[key] === value) continue;
    merged[key] = value;
    changed = true;
  }
  return changed ? replaceGate(circuit, { ...gate, params: merged }) : circuit;
}

/** Swap which qubit is the control. The spanned rows are unchanged, so it cannot collide. */
export function swapControlTarget(circuit: EditorCircuit, id: string): EditorCircuit | null {
  const gate = circuit.gates.find((g) => g.id === id);
  if (!gate || gate.control === undefined) return null;
  return replaceGate(circuit, { ...gate, qubit: gate.control, control: gate.qubit });
}

export function removeGate(circuit: EditorCircuit, id: string): EditorCircuit | null {
  if (!circuit.gates.some((g) => g.id === id)) return null;
  return { ...circuit, gates: circuit.gates.filter((g) => g.id !== id) };
}

/** Clamp to 1–8 qubits. Shrinking drops every gate that touches a removed row. */
export function setQubitCount(circuit: EditorCircuit, count: number): EditorCircuit {
  const qubitCount = Math.min(MAX_QUBITS, Math.max(MIN_QUBITS, Math.round(count) || MIN_QUBITS));
  if (qubitCount === circuit.qubitCount) return circuit;
  return {
    qubitCount,
    gates: circuit.gates.filter((g) => gateRows(g).every((q) => q < qubitCount)),
  };
}

/** The gate covering (qubit, column), including the rows a two-qubit gate spans. */
export function gateAt(circuit: EditorCircuit, qubit: number, column: number): EditorGate | null {
  return circuit.gates.find((g) => g.column === column && gateRows(g).includes(qubit)) ?? null;
}

/** Number of columns in use (highest occupied column + 1). */
export function usedColumns(circuit: EditorCircuit): number {
  return circuit.gates.reduce((max, g) => Math.max(max, g.column + 1), 0);
}
