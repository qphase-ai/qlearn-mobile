import type { CircuitSpec, GateSpec } from '@/types/contracts';

/**
 * Pack gates into columns for a read-only diagram. A gate occupies every row
 * between its control and target (so connector lines never cross another
 * gate); it goes in the first column after the last one used on those rows,
 * preserving gate order per qubit.
 */

export interface PlacedGate {
  gate: GateSpec;
  column: number;
  targets: number[];
  control: number | null;
}

export interface CircuitLayout {
  qubits: number;
  columns: number;
  gates: PlacedGate[];
}

export function layoutCircuit(spec: Pick<CircuitSpec, 'qubits' | 'gates'>): CircuitLayout {
  const qubits = Math.max(1, Math.floor(spec.qubits || 0));
  const nextFree = new Array<number>(qubits).fill(0);
  const placed: PlacedGate[] = [];

  for (const gate of spec.gates ?? []) {
    const targets = (gate.targets?.length ? gate.targets : [0]).filter((q) => q >= 0 && q < qubits);
    if (targets.length === 0) continue;
    const control =
      typeof gate.control === 'number' && gate.control >= 0 && gate.control < qubits ? gate.control : null;
    const rows = control === null ? targets : [...targets, control];
    const lo = Math.min(...rows);
    const hi = Math.max(...rows);
    let column = 0;
    for (let q = lo; q <= hi; q++) column = Math.max(column, nextFree[q]);
    for (let q = lo; q <= hi; q++) nextFree[q] = column + 1;
    placed.push({ gate, column, targets, control });
  }

  return { qubits, columns: Math.max(0, ...nextFree), gates: placed };
}
