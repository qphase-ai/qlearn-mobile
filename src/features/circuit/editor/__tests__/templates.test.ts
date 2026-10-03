import { TEMPLATES } from '../templates';

describe('TEMPLATES', () => {
  it('has unique ids and labels each one as an example', () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
    for (const t of TEMPLATES) expect(t.description).toMatch(/^Example:/);
  });

  it('builds the Bell state as H, CX 0→1, then measures both qubits', () => {
    const bell = TEMPLATES.find((t) => t.id === 'bell');
    expect(bell?.spec).toEqual({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'CX', control: 0, targets: [1] },
        { type: 'M', targets: [0], classical: [0] },
        { type: 'M', targets: [1], classical: [1] },
      ],
    });
  });

  it('includes superposition, GHZ and interference', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(['superposition', 'bell', 'ghz', 'interference']);
    expect(TEMPLATES.find((t) => t.id === 'ghz')?.spec.qubits).toBe(3);
  });
});
