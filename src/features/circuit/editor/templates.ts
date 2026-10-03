import type { CircuitSpec } from '@/types/contracts';

/**
 * Starter circuits for an empty editor. They are worked examples to explore,
 * not exercises: loading one is never graded or reported as progress.
 */

export interface CircuitTemplate {
  id: string;
  title: string;
  description: string;
  spec: CircuitSpec;
}

const measure = (q: number) => ({ type: 'M', targets: [q], classical: [q] });

export const TEMPLATES: readonly CircuitTemplate[] = [
  {
    id: 'superposition',
    title: 'Superposition',
    description: 'Example: a Hadamard puts one qubit in an equal mix of 0 and 1.',
    spec: { qubits: 1, classical_bits: 1, gates: [{ type: 'H', targets: [0] }, measure(0)] },
  },
  {
    id: 'bell',
    title: 'Bell state',
    description: 'Example: H and CNOT entangle two qubits, so they always measure the same.',
    spec: {
      qubits: 2,
      classical_bits: 2,
      gates: [{ type: 'H', targets: [0] }, { type: 'CX', control: 0, targets: [1] }, measure(0), measure(1)],
    },
  },
  {
    id: 'ghz',
    title: 'GHZ state',
    description: 'Example: entanglement spread across three qubits — all 000 or all 111.',
    spec: {
      qubits: 3,
      classical_bits: 3,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'CX', control: 0, targets: [1] },
        { type: 'CX', control: 1, targets: [2] },
        measure(0),
        measure(1),
        measure(2),
      ],
    },
  },
  {
    id: 'interference',
    title: 'Interference',
    description: 'Example: two Hadamards cancel out, so the qubit always returns to 0.',
    spec: {
      qubits: 1,
      classical_bits: 1,
      gates: [{ type: 'H', targets: [0] }, { type: 'H', targets: [0] }, measure(0)],
    },
  },
];
