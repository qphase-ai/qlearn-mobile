import { circuitSpecToQiskitSource } from '../qiskit';

describe('circuitSpecToQiskitSource', () => {
  it('renders a Bell circuit like the web', () => {
    const source = circuitSpecToQiskitSource({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'CX', control: 0, targets: [1] },
        { type: 'M', targets: [0], classical: [0] },
        { type: 'M', targets: [1], classical: [1] },
      ],
    });
    expect(source).toBe(
      [
        'from qiskit import QuantumCircuit',
        'from qiskit_aer import AerSimulator',
        '',
        'qc = QuantumCircuit(2, 2)',
        'qc.h(0)',
        'qc.cx(0, 1)',
        'qc.measure([0,1], [0,1])',
      ].join('\n')
    );
  });

  it('formats parameters in θ, φ, λ order and skips unknown gates', () => {
    const source = circuitSpecToQiskitSource({
      qubits: 1,
      classical_bits: 1,
      gates: [
        { type: 'RX', targets: [0], params: { theta: Math.PI / 2 } },
        { type: 'U', targets: [0], params: { theta: 1, phi: 0.5 } },
        { type: 'HOLOGRAM', targets: [0] },
      ],
    });
    expect(source).toContain('qc.rx(1.57079632679, 0)');
    expect(source).toContain('qc.u(1.0, 0.5, 0.0, 0)');
    expect(source).not.toContain('HOLOGRAM');
  });
});
