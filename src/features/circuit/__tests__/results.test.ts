import { probabilityRows, stateRows } from '../results';

describe('probabilityRows', () => {
  it('sorts basis states and rounds percentages', () => {
    expect(probabilityRows({ probabilities: { '11': 0.4951, '00': 0.5049 } })).toEqual([
      { label: '|00⟩', probability: 0.5049, percent: 50 },
      { label: '|11⟩', probability: 0.4951, percent: 50 },
    ]);
    expect(probabilityRows({ probabilities: null })).toEqual([]);
  });
});

describe('stateRows', () => {
  it('formats a Bell-state statevector with little-endian labels', () => {
    const r = Math.SQRT1_2;
    const rows = stateRows({ statevector: [[r, 0], [0, 0], [0, 0], [0, -r]], probabilities: null });
    expect(rows.map((x) => x.label)).toEqual(['|00⟩', '|01⟩', '|10⟩', '|11⟩']);
    expect(rows[0]).toEqual({ label: '|00⟩', amplitude: '0.707', probability: '50%', phase: '0°' });
    expect(rows[1].phase).toBe('—');
    expect(rows[3].phase).toBe('-90°');
  });

  it('falls back to probabilities when no statevector is returned', () => {
    expect(stateRows({ statevector: null, probabilities: { '1': 1 } })).toEqual([
      { label: '|1⟩', amplitude: '1.000', probability: '100%', phase: '—' },
    ]);
  });
});
