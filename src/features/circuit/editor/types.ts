/**
 * The circuit editor's own model: gates on a qubit × column grid. It exists
 * only on the device; everything that crosses the API is the canonical
 * `CircuitSpec` produced by `serialize.ts`, so the backend never sees this.
 */

export type GateType =
  | 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'I' | 'SX'
  | 'RX' | 'RY' | 'RZ' | 'P' | 'U' | 'U3'
  | 'CX' | 'CZ' | 'SWAP' | 'RXX' | 'RYY' | 'RZZ'
  | 'M';

/** Gate angles in radians. */
export interface GateParams {
  theta?: number;
  phi?: number;
  lambda?: number;
}

export interface EditorGate {
  id: string;
  type: GateType;
  /** 0-based time step. */
  column: number;
  /** The target qubit. */
  qubit: number;
  /** Second qubit of a two-qubit gate (the control for CX/CZ). */
  control?: number;
  /** Only for parametric gates, with every key the gate defines present. */
  params?: GateParams;
}

export interface EditorCircuit {
  qubitCount: number;
  gates: EditorGate[];
}

/** Web parity for the qubit range; the column bound keeps rendering bounded. */
export const MIN_QUBITS = 1;
export const MAX_QUBITS = 8;
export const MAX_COLUMNS = 40;
