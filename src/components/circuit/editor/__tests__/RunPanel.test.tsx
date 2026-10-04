import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { validateCircuit } from '@/features/circuit/editor/validate';
import { useCircuitRun, type CircuitRunState } from '@/features/circuit/useCircuitRun';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { RunPanel } from '../RunPanel';
import { editor, resetEditorStore } from './test-utils';

jest.mock('@/features/circuit/useCircuitRun', () => {
  const actual = jest.requireActual('@/features/circuit/useCircuitRun');
  return { ...actual, useCircuitRun: jest.fn() };
});

const mockedUseCircuitRun = useCircuitRun as jest.MockedFunction<typeof useCircuitRun>;
const run = jest.fn();
const withState = (state: CircuitRunState) => mockedUseCircuitRun.mockReturnValue({ state, run });

const bell = () =>
  useCircuitEditorStore.setState({
    name: 'Bell',
    gates: [
      { id: 'h', type: 'H', qubit: 0, column: 0 },
      { id: 'c', type: 'CX', qubit: 1, control: 0, column: 1 },
    ],
  });

beforeEach(async () => {
  await resetEditorStore();
  run.mockReset();
  withState({ status: 'idle' });
});

afterEach(() => onlineManager.setOnline(true));

const runButton = () => screen.getByRole('button', { name: /Run (circuit|again)/ });

describe('RunPanel', () => {
  it('keeps Run disabled on an empty circuit', async () => {
    await render(<RunPanel />);
    expect(runButton()).toBeDisabled();
    expect(screen.getByTestId('run-blocker')).toHaveTextContent('Add a gate to run your circuit.');
  });

  it('blocks an invalid circuit and shows the first problem', async () => {
    // A rotation whose angle is not finite (e.g. from a corrupt load) cannot run.
    useCircuitEditorStore.setState({
      gates: [{ id: 'r', type: 'RX', qubit: 0, column: 0, params: { theta: Number.NaN } }],
    });
    await render(<RunPanel />);
    expect(runButton()).toBeDisabled();
    const [first] = validateCircuit(editor().spec());
    expect(first).toBeTruthy();
    expect(screen.getByTestId('run-blocker')).toHaveTextContent(first);
  });

  it('disables Run offline and says why', async () => {
    bell();
    await render(<RunPanel />);
    expect(runButton()).toBeEnabled();
    await act(async () => onlineManager.setOnline(false));
    expect(runButton()).toBeDisabled();
    expect(screen.getByTestId('run-blocker')).toHaveTextContent("You're offline. Runs need the Q-Learn simulator.");
    await fireEvent.press(runButton());
    expect(run).not.toHaveBeenCalled();
  });

  it('is busy while a run is in flight', async () => {
    bell();
    withState({ status: 'running' });
    await render(<RunPanel />);
    expect(screen.getByRole('button', { name: 'Run circuit' })).toBeDisabled();
    expect(screen.getByTestId('button-spinner')).toBeTruthy();
  });

  it('runs the canonical spec with the chosen shots', async () => {
    bell();
    await render(<RunPanel />);
    await fireEvent.press(screen.getByRole('radio', { name: '4096 shots' }));
    expect(editor().shots).toBe(4096);
    expect(screen.getByRole('radio', { name: '4096 shots' })).toBeChecked();
    await fireEvent.press(runButton());
    expect(run).toHaveBeenCalledWith(
      {
        qubits: 2,
        classical_bits: 2,
        gates: [
          { type: 'H', targets: [0] },
          { type: 'CX', control: 0, targets: [1] },
        ],
      },
      4096,
      'Bell',
    );
  });

  it('shows results with a view toggle and flags an edited circuit', async () => {
    bell();
    await render(<RunPanel />);
    await fireEvent.press(runButton());
    withState({
      status: 'done',
      result: {
        status: 'completed',
        probabilities: { '00': 0.5, '11': 0.5 },
        measurements: null,
        statevector: [
          [Math.SQRT1_2, 0],
          [0, 0],
          [0, 0],
          [Math.SQRT1_2, 0],
        ],
        execution_time_ms: 5,
      },
    });
    await screen.rerender(<RunPanel />); // pick up the mocked result
    expect(screen.getByLabelText('00: 50 percent')).toBeTruthy();
    expect(screen.queryByText(/You changed the circuit/)).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'State vector' }));
    expect(screen.queryByLabelText('00: 50 percent')).toBeNull();

    await act(() => useCircuitEditorStore.setState({ gates: editor().gates.slice(0, 1) }));
    expect(screen.getByText(/You changed the circuit/)).toBeTruthy();
  });

  it('flags a result once the shots change', async () => {
    bell();
    withState({ status: 'idle' });
    await render(<RunPanel />);
    await fireEvent.press(runButton());
    withState({
      status: 'done',
      result: { status: 'completed', probabilities: { '00': 1 }, measurements: null, statevector: null, execution_time_ms: 1 },
    });
    await screen.rerender(<RunPanel />); // pick up the mocked result
    expect(screen.queryByText(/You changed the circuit or shots/)).toBeNull();
    await fireEvent.press(screen.getByRole('radio', { name: '256 shots' }));
    expect(screen.getByText(/You changed the circuit or shots/)).toBeTruthy();
  });

  it('lists up to three problems, then how many more', async () => {
    const bad = (id: string, column: number) => ({
      id,
      type: 'RX' as const,
      qubit: 0,
      column,
      params: { theta: Number.NaN },
    });
    useCircuitEditorStore.setState({ gates: [0, 1, 2, 3, 4].map((c) => bad(`r${c}`, c)) });
    await render(<RunPanel />);
    const errors = validateCircuit(editor().spec());
    expect(errors.length).toBe(5);
    expect(screen.getAllByText(errors[0])).toHaveLength(3);
    expect(screen.getByText('+2 more')).toBeTruthy();
  });

  it('shows run errors like the lesson simulation does', async () => {
    const { CircuitRunError } = jest.requireActual('@/features/circuit/useCircuitRun');
    bell();
    withState({ status: 'error', error: new CircuitRunError('The simulation took too long. Please try again.') });
    await render(<RunPanel />);
    expect(screen.getByText('The simulation took too long. Please try again.')).toBeTruthy();
  });
});
