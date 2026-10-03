import { GateColors } from '@/constants/theme';

import {
  ANGLE_PRESETS,
  defaultParams,
  formatAngle,
  GATES,
  isGateType,
  isParametric,
  isTwoQubitGate,
  MAIN_GATES,
  MORE_GATES,
} from '../gates';
import type { GateType } from '../types';

describe('gate catalog', () => {
  const all = Object.keys(GATES) as GateType[];

  it('lists every gate exactly once across the main and "More" palettes', () => {
    expect([...MAIN_GATES, ...MORE_GATES].sort()).toEqual([...all].sort());
    for (const type of MORE_GATES) expect(GATES[type].more).toBe(true);
    for (const type of MAIN_GATES) expect(GATES[type].more).toBeFalsy();
  });

  it('keys each entry by its own type and resolves a theme color', () => {
    for (const type of all) {
      expect(GATES[type].type).toBe(type);
      expect(GateColors[GATES[type].colorKey]).toMatch(/^#/);
    }
  });

  it('marks the two-qubit gates', () => {
    expect(all.filter(isTwoQubitGate).sort()).toEqual(['CX', 'CZ', 'RXX', 'RYY', 'RZZ', 'SWAP']);
  });

  it('defines θ for rotations and θ, φ, λ for U/U3', () => {
    for (const type of ['RX', 'RY', 'RZ', 'P', 'RXX', 'RYY', 'RZZ'] as GateType[]) {
      expect(GATES[type].params.map((p) => p.key)).toEqual(['theta']);
    }
    expect(GATES.U.params.map((p) => p.key)).toEqual(['theta', 'phi', 'lambda']);
    expect(GATES.U3.params.map((p) => p.key)).toEqual(['theta', 'phi', 'lambda']);
    expect(all.filter(isParametric).sort()).toEqual(['P', 'RX', 'RXX', 'RY', 'RYY', 'RZ', 'RZZ', 'U', 'U3']);
  });

  it('categorizes gates', () => {
    expect(GATES.H.category).toBe('single');
    expect(GATES.RX.category).toBe('rotation');
    expect(GATES.CX.category).toBe('multi');
    expect(GATES.M.category).toBe('measure');
  });
});

describe('isGateType', () => {
  it('accepts catalog types only', () => {
    expect(isGateType('CX')).toBe(true);
    expect(isGateType('CNOT')).toBe(false);
    expect(isGateType('h')).toBe(false);
    expect(isGateType('toString')).toBe(false);
    expect(isGateType(3)).toBe(false);
  });
});

describe('defaultParams', () => {
  it('gives θ = π/2 and φ = λ = 0', () => {
    expect(defaultParams('RY')).toEqual({ theta: Math.PI / 2 });
    expect(defaultParams('U')).toEqual({ theta: Math.PI / 2, phi: 0, lambda: 0 });
    expect(defaultParams('H')).toBeUndefined();
  });

  it('returns a fresh object each call', () => {
    const a = defaultParams('RX');
    a!.theta = 1;
    expect(defaultParams('RX')).toEqual({ theta: Math.PI / 2 });
  });
});

describe('formatAngle', () => {
  it('shows multiples of π symbolically, like the web', () => {
    expect(formatAngle(0)).toBe('0');
    expect(formatAngle(Math.PI)).toBe('π');
    expect(formatAngle(Math.PI / 2)).toBe('π/2');
    expect(formatAngle((3 * Math.PI) / 4)).toBe('3π/4');
    expect(formatAngle(2 * Math.PI)).toBe('2π');
    expect(formatAngle(-Math.PI / 4)).toBe('−π/4');
  });

  it('falls back to two decimals', () => {
    expect(formatAngle(1)).toBe('1.00');
    expect(formatAngle(-0.5)).toBe('−0.50');
  });

  it('labels the presets consistently', () => {
    for (const preset of ANGLE_PRESETS) expect(formatAngle(preset.value)).toBe(preset.label);
  });
});
