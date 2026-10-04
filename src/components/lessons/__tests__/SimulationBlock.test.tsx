import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useCircuitRun } from '@/features/circuit/useCircuitRun';

import { SimulationBlock } from '../blocks/SimulationBlock';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('@/features/circuit/useCircuitRun', () => {
  const actual = jest.requireActual('@/features/circuit/useCircuitRun');
  return { ...actual, useCircuitRun: jest.fn() };
});

const run = jest.fn();
(useCircuitRun as jest.MockedFunction<typeof useCircuitRun>).mockReturnValue({ state: { status: 'idle' }, run });

afterEach(() => onlineManager.setOnline(true));

const circuit = { qubits: 1, classical_bits: 1, gates: [{ type: 'H', targets: [0] }] };

describe('SimulationBlock', () => {
  it('disables Run offline and says why', async () => {
    await render(
      <SimulationBlock blockType="simulation" circuit={circuit} shots={1024} view="probabilities" title="Coin flip" />
    );
    const button = screen.getByRole('button', { name: 'Run simulation' });
    expect(button).toBeEnabled();
    expect(screen.getByText('1024 shots · runs on the Q-Learn simulator')).toBeTruthy();

    await act(async () => onlineManager.setOnline(false));

    expect(button).toBeDisabled();
    expect(screen.getByText("You're offline. Runs need the Q-Learn simulator.")).toBeTruthy();
    await fireEvent.press(button);
    expect(run).not.toHaveBeenCalled();
  });
});
