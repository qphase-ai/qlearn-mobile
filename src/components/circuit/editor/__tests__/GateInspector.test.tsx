import { fireEvent, render, screen } from '@testing-library/react-native';

import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { GateInspector, stepAngle } from '../GateInspector';
import { editor, resetEditorStore } from './test-utils';

beforeEach(resetEditorStore);

const select = useCircuitEditorStore.setState;

describe('GateInspector', () => {
  it('renders nothing without a selection', async () => {
    await render(<GateInspector />);
    expect(screen.queryByTestId('gate-inspector')).toBeNull();
  });

  it('edits a rotation angle with presets and steppers, then deletes the gate', async () => {
    select({
      gates: [{ id: 'r', type: 'RX', qubit: 0, column: 0, params: { theta: Math.PI / 2 } }],
      selectedId: 'r',
    });
    await render(<GateInspector />);
    expect(screen.getByText('R-X')).toBeTruthy();
    expect(screen.getByTestId('param-theta')).toHaveTextContent('θ = π/2');

    await fireEvent.press(screen.getByRole('button', { name: 'Set θ to π' }));
    expect(editor().gates[0].params).toEqual({ theta: Math.PI });
    expect(screen.getByTestId('param-theta')).toHaveTextContent('θ = π');
    expect(screen.getByRole('button', { name: 'Set θ to π' })).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Decrease θ' }));
    expect(editor().gates[0].params?.theta).toBeCloseTo((11 * Math.PI) / 12);

    await fireEvent.press(screen.getByRole('button', { name: 'Delete gate' }));
    expect(editor().gates).toEqual([]);
    expect(screen.queryByTestId('gate-inspector')).toBeNull();
  });

  it('swaps control and target of a CNOT', async () => {
    select({ gates: [{ id: 'c', type: 'CX', qubit: 1, control: 0, column: 0 }], selectedId: 'c' });
    await render(<GateInspector />);
    expect(screen.getByText(/Control q0 → target q1/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Swap control/target' }));
    expect(editor().gates[0]).toMatchObject({ qubit: 0, control: 1 });
    expect(screen.getByText(/Control q1 → target q0/)).toBeTruthy();
  });

  it('moves the selected gate one cell at a time, disabling moves the model would reject', async () => {
    select({
      gates: [
        { id: 'h', type: 'H', qubit: 0, column: 0 },
        { id: 'x', type: 'X', qubit: 1, column: 1 },
      ],
      selectedId: 'h',
    });
    await render(<GateInspector />);
    const button = (name: string) => screen.getByRole('button', { name });
    // Column 0, qubit 0: nothing to the left or above.
    expect(button('Move left')).toBeDisabled();
    expect(button('Move up')).toBeDisabled();
    expect(button('Move down')).toBeEnabled();

    await fireEvent.press(button('Move right'));
    expect(editor().gates[0]).toMatchObject({ id: 'h', qubit: 0, column: 1 });
    expect(editor().selectedId).toBe('h');
    expect(screen.getByText(/Qubit q0 · step 2/)).toBeTruthy();
    // The X now sits right below.
    expect(button('Move down')).toBeDisabled();
    expect(button('Move left')).toBeEnabled();

    await fireEvent.press(button('Move down')); // disabled: no change, no undo step
    expect(editor().gates[0]).toMatchObject({ qubit: 0, column: 1 });
    expect(editor().past).toHaveLength(1);

    await fireEvent.press(button('Move left'));
    expect(editor().gates[0]).toMatchObject({ qubit: 0, column: 0 });
  });

  it('moves a two-qubit gate with its control, within the qubit range', async () => {
    select({ qubitCount: 3, gates: [{ id: 'c', type: 'CX', qubit: 1, control: 0, column: 0 }], selectedId: 'c' });
    await render(<GateInspector />);
    expect(screen.getByRole('button', { name: 'Move up' })).toBeDisabled(); // control would leave the grid
    await fireEvent.press(screen.getByRole('button', { name: 'Move down' }));
    expect(editor().gates[0]).toMatchObject({ qubit: 2, control: 1 });
    expect(screen.getByRole('button', { name: 'Move down' })).toBeDisabled();
  });

  it('steps angles on the π/12 grid within ±2π', () => {
    expect(stepAngle(0, 1)).toBeCloseTo(Math.PI / 12);
    expect(stepAngle(1, -1)).toBeCloseTo((3 * Math.PI) / 12); // 1 rad snaps to 4π/12 first
    expect(stepAngle(2 * Math.PI, 1)).toBeCloseTo(2 * Math.PI);
  });
});
