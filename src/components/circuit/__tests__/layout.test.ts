import { layoutCircuit } from '../layout';

describe('layoutCircuit', () => {
  it('packs independent gates into the same column', () => {
    const layout = layoutCircuit({
      qubits: 2,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'X', targets: [1] },
      ],
    });
    expect(layout.gates.map((g) => g.column)).toEqual([0, 0]);
    expect(layout.columns).toBe(1);
  });

  it('blocks every row a controlled gate spans', () => {
    const layout = layoutCircuit({
      qubits: 3,
      gates: [
        { type: 'CX', control: 0, targets: [2] },
        { type: 'H', targets: [1] },
        { type: 'M', targets: [0] },
      ],
    });
    expect(layout.gates.map((g) => g.column)).toEqual([0, 1, 1]);
    expect(layout.gates[0].control).toBe(0);
  });

  it('drops gates on out-of-range qubits and clamps the qubit count', () => {
    const layout = layoutCircuit({ qubits: 0, gates: [{ type: 'H', targets: [5] }] });
    expect(layout.qubits).toBe(1);
    expect(layout.gates).toHaveLength(0);
    expect(layout.columns).toBe(0);
  });
});
