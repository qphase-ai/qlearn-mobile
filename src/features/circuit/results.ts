import type { SimulationResult } from '@/types/contracts';

/**
 * Result formatting, ported from the web's ProbabilityChart and
 * StateVectorTable so both clients show identical numbers. Basis labels use
 * Qiskit's little-endian convention: index i → binary of i, qubit 0 rightmost.
 */

export interface ProbabilityRow {
  label: string;
  probability: number;
  percent: number;
}

export function probabilityRows(result: Pick<SimulationResult, 'probabilities'>): ProbabilityRow[] {
  if (!result.probabilities) return [];
  return Object.entries(result.probabilities)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, probability]) => ({
      label: `|${key}⟩`,
      probability,
      percent: Math.round(probability * 100),
    }));
}

export interface StateRow {
  label: string;
  amplitude: string;
  probability: string;
  phase: string;
}

export function stateRows(result: Pick<SimulationResult, 'statevector' | 'probabilities'>): StateRow[] {
  const sv = result.statevector;
  if (sv && sv.length > 0) {
    const nBits = Math.max(1, Math.round(Math.log2(sv.length)));
    return sv.map(([re, im], i) => {
      const amp = Math.hypot(re, im);
      return {
        label: `|${i.toString(2).padStart(nBits, '0')}⟩`,
        amplitude: amp.toFixed(3),
        probability: `${Math.round(amp * amp * 100)}%`,
        phase: amp < 1e-6 ? '—' : `${Math.round((Math.atan2(im, re) * 180) / Math.PI)}°`,
      };
    });
  }
  return probabilityRows(result).map((row) => ({
    label: row.label,
    amplitude: Math.sqrt(row.probability).toFixed(3),
    probability: `${row.percent}%`,
    phase: '—',
  }));
}
