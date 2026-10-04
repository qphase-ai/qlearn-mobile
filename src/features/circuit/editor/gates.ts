import type { GateColors } from '@/constants/theme';

import type { GateParams, GateType } from './types';

/**
 * Gate catalog, ported from the web's `frontend/src/lib/gates.ts` so both
 * builders describe, default and label gates identically. The palette,
 * canvas and inspector read everything about a gate from here.
 */

export type GateCategory = 'single' | 'rotation' | 'multi' | 'measure';
export type GateParamKey = keyof GateParams;

export interface GateParamDef {
  key: GateParamKey;
  label: string;
  default: number;
}

export interface GateDef {
  type: GateType;
  /** Short label drawn on the gate body. */
  symbol: string;
  name: string;
  description: string;
  category: GateCategory;
  arity: 1 | 2;
  params: GateParamDef[];
  /** Listed behind the palette's "More" toggle instead of the main set. */
  more?: boolean;
  /** Fill color, resolved through `GateColors` so it follows the theme tokens. */
  colorKey: keyof typeof GateColors;
}

const THETA: GateParamDef = { key: 'theta', label: 'θ', default: Math.PI / 2 };
const PHI: GateParamDef = { key: 'phi', label: 'φ', default: 0 };
const LAMBDA: GateParamDef = { key: 'lambda', label: 'λ', default: 0 };

const DEFS: GateDef[] = [
  {
    type: 'H', symbol: 'H', name: 'Hadamard', category: 'single', arity: 1, params: [], colorKey: 'H',
    description: 'Creates an equal superposition: maps |0⟩ to |+⟩ and |1⟩ to |−⟩.',
  },
  {
    type: 'X', symbol: 'X', name: 'Pauli-X', category: 'single', arity: 1, params: [], colorKey: 'X',
    description: 'Quantum NOT — flips |0⟩ ↔ |1⟩ (a π rotation about the X axis).',
  },
  {
    type: 'Y', symbol: 'Y', name: 'Pauli-Y', category: 'single', arity: 1, params: [], colorKey: 'Y',
    description: 'Bit and phase flip — a π rotation about the Y axis.',
  },
  {
    type: 'Z', symbol: 'Z', name: 'Pauli-Z', category: 'single', arity: 1, params: [], colorKey: 'Z',
    description: 'Phase flip — leaves |0⟩ unchanged and maps |1⟩ to −|1⟩.',
  },
  {
    type: 'S', symbol: 'S', name: 'S Gate', category: 'single', arity: 1, params: [], colorKey: 'S',
    description: 'Quarter-turn phase gate (√Z): adds a phase of i to |1⟩.',
  },
  {
    type: 'T', symbol: 'T', name: 'T Gate', category: 'single', arity: 1, params: [], colorKey: 'T',
    description: 'Eighth-turn phase gate (√S): adds a phase of e^{iπ/4} to |1⟩.',
  },
  {
    type: 'I', symbol: 'I', name: 'Identity', category: 'single', arity: 1, params: [], more: true,
    colorKey: 'I',
    description: 'Does nothing — useful as an explicit idle step.',
  },
  {
    type: 'SX', symbol: '√X', name: 'SX Gate', category: 'single', arity: 1, params: [], more: true,
    colorKey: 'SX',
    description: 'Square root of X — two in a row equal one X gate.',
  },
  {
    type: 'RX', symbol: 'Rx', name: 'R-X', category: 'rotation', arity: 1, params: [THETA], more: true,
    colorKey: 'rotation',
    description: 'Rotates the state by θ around the X axis of the Bloch sphere.',
  },
  {
    type: 'RY', symbol: 'Ry', name: 'R-Y', category: 'rotation', arity: 1, params: [THETA], more: true,
    colorKey: 'rotation',
    description: 'Rotates the state by θ around the Y axis — real-valued amplitudes.',
  },
  {
    type: 'RZ', symbol: 'Rz', name: 'R-Z', category: 'rotation', arity: 1, params: [THETA], more: true,
    colorKey: 'rotation',
    description: 'Rotates the state by θ around the Z axis — changes relative phase only.',
  },
  {
    type: 'P', symbol: 'P', name: 'Phase', category: 'rotation', arity: 1, params: [THETA], more: true,
    colorKey: 'P',
    description: 'Adds a phase of e^{iθ} to |1⟩. S and T are special cases.',
  },
  {
    type: 'U', symbol: 'U', name: 'U Gate', category: 'rotation', arity: 1, params: [THETA, PHI, LAMBDA],
    more: true, colorKey: 'U',
    description: 'General single-qubit rotation with Euler angles θ, φ, λ.',
  },
  {
    type: 'U3', symbol: 'U3', name: 'U3', category: 'rotation', arity: 1, params: [THETA, PHI, LAMBDA],
    more: true, colorKey: 'SX',
    description: 'Legacy three-parameter rotation — identical to U(θ, φ, λ).',
  },
  {
    type: 'CX', symbol: 'CX', name: 'CNOT', category: 'multi', arity: 2, params: [], colorKey: 'CX',
    description: 'Flips the target qubit when the control is |1⟩ — the workhorse of entanglement.',
  },
  {
    type: 'CZ', symbol: 'CZ', name: 'Controlled-Z', category: 'multi', arity: 2, params: [], colorKey: 'CX',
    description: 'Applies a −1 phase when both qubits are |1⟩. Symmetric in its qubits.',
  },
  {
    type: 'SWAP', symbol: 'SWAP', name: 'SWAP', category: 'multi', arity: 2, params: [], colorKey: 'CX',
    description: 'Exchanges the states of two qubits.',
  },
  {
    type: 'RXX', symbol: 'Rxx', name: 'R-XX', category: 'multi', arity: 2, params: [THETA], more: true,
    colorKey: 'rotation',
    description: 'Ising XX interaction: rotates both qubits by θ about X⊗X.',
  },
  {
    type: 'RYY', symbol: 'Ryy', name: 'R-YY', category: 'multi', arity: 2, params: [THETA], more: true,
    colorKey: 'rotation',
    description: 'Ising YY interaction: rotates both qubits by θ about Y⊗Y.',
  },
  {
    type: 'RZZ', symbol: 'Rzz', name: 'R-ZZ', category: 'multi', arity: 2, params: [THETA], more: true,
    colorKey: 'rotation',
    description: 'Ising ZZ interaction: a θ phase rotation about Z⊗Z.',
  },
  {
    type: 'M', symbol: 'M', name: 'Measure', category: 'measure', arity: 1, params: [], colorKey: 'M',
    description: 'Collapses the qubit to |0⟩ or |1⟩ and records the result in a classical bit.',
  },
];

export const GATES = Object.fromEntries(DEFS.map((d) => [d.type, d])) as Record<GateType, GateDef>;

/** Palette order: the main set first, then the "More" set. */
export const MAIN_GATES: readonly GateType[] = ['H', 'X', 'Y', 'Z', 'S', 'T', 'CX', 'CZ', 'SWAP', 'M'];
export const MORE_GATES: readonly GateType[] = [
  'I', 'SX', 'RX', 'RY', 'RZ', 'P', 'U', 'U3', 'RXX', 'RYY', 'RZZ',
];

export function isGateType(value: unknown): value is GateType {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(GATES, value);
}

export function isTwoQubitGate(type: GateType): boolean {
  return GATES[type].arity === 2;
}

export function isParametric(type: GateType): boolean {
  return GATES[type].params.length > 0;
}

/** Every param the gate defines at its default, or undefined for fixed gates. */
export function defaultParams(type: GateType): GateParams | undefined {
  const defs = GATES[type].params;
  if (defs.length === 0) return undefined;
  return Object.fromEntries(defs.map((p) => [p.key, p.default])) as GateParams;
}

export type AngleResult = { ok: true; value: number } | { ok: false; error: 'not-a-number' | 'not-finite' };

/**
 * A request-supplied angle read the way the backend's `_angle` reads it: a
 * missing angle is 0, a numeric string is parsed (Python `float()`), and
 * anything else present must be a finite number.
 */
export function parseAngle(raw: unknown): AngleResult {
  if (raw === undefined) return { ok: true, value: 0 };
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (Number.isNaN(value)) return { ok: false, error: 'not-a-number' };
  if (!Number.isFinite(value)) return { ok: false, error: 'not-finite' };
  return { ok: true, value };
}

// Common multiples of π are shown symbolically, exactly as the web does.
const PI_FRACTIONS: [number, number][] = [
  [1, 1], [1, 2], [1, 3], [1, 4], [1, 6], [1, 8], [2, 3], [3, 4], [3, 2], [2, 1],
];

export function formatAngle(radians: number): string {
  if (Math.abs(radians) < 1e-9) return '0';
  const sign = radians < 0 ? '−' : '';
  const abs = Math.abs(radians);
  for (const [n, d] of PI_FRACTIONS) {
    if (Math.abs(abs - (n * Math.PI) / d) < 1e-6) {
      const num = n === 1 ? 'π' : `${n}π`;
      return d === 1 ? `${sign}${num}` : `${sign}${num}/${d}`;
    }
  }
  return `${sign}${abs.toFixed(2)}`;
}

/** Inspector shortcuts. */
export const ANGLE_PRESETS: readonly { label: string; value: number }[] = [
  { label: 'π/4', value: Math.PI / 4 },
  { label: 'π/2', value: Math.PI / 2 },
  { label: 'π', value: Math.PI },
  { label: '−π/2', value: -Math.PI / 2 },
];
