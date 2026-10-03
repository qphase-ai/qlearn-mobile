import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { CircuitCanvas, cellLabel, circuitSummary } from '../CircuitCanvas';
import { GatePalette } from '../GatePalette';
import { editor, resetEditorStore } from './test-utils';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `gate-${++n}` };
});

beforeEach(async () => {
  await resetEditorStore();
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

async function renderEditor() {
  await render(
    <>
      <GatePalette />
      <CircuitCanvas />
    </>,
  );
  // Let the screen-reader check resolve and render the cell overlay.
  await act(async () => {});
}

describe('CircuitCanvas', () => {
  it('renders the SVG with a summary and no cells when no screen reader is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    await render(<CircuitCanvas />);
    await act(async () => {});
    expect(screen.getByTestId('circuit-canvas').props.accessibilityLabel).toBe('Circuit with 2 qubits and 0 gates.');
    expect(screen.queryByTestId('canvas-cell-0-0')).toBeNull();
  });

  it('places a single-qubit gate through the screen-reader cells', async () => {
    await renderEditor();
    await fireEvent.press(screen.getByTestId('palette-H'));
    await fireEvent.press(screen.getByTestId('canvas-cell-0-0'));
    expect(editor().gates).toMatchObject([{ type: 'H', qubit: 0, column: 0 }]);
    expect(screen.getByLabelText('Qubit 0, step 1, Hadamard gate')).toBeTruthy();
    expect(screen.getByTestId('circuit-canvas').props.accessibilityLabel).toBe(
      'Circuit with 2 qubits and 1 gate. step 1: Hadamard on qubit 0.',
    );
  });

  it('places a CNOT with two taps, showing the pending control in between', async () => {
    await renderEditor();
    await fireEvent.press(screen.getByTestId('palette-CX'));
    expect(screen.getByTestId('palette-status')).toHaveTextContent('Tap the control qubit for CNOT');
    await fireEvent.press(screen.getByTestId('canvas-cell-0-1'));
    expect(screen.getByTestId('pending-control')).toBeTruthy();
    expect(screen.getByTestId('palette-status')).toHaveTextContent(/Now tap the target qubit/);
    await fireEvent.press(screen.getByTestId('canvas-cell-1-2'));
    expect(editor().gates).toMatchObject([{ type: 'CX', control: 0, qubit: 1, column: 1 }]);
    expect(screen.queryByTestId('pending-control')).toBeNull();
    expect(screen.getByLabelText('Qubit 1, step 2, CNOT target, controlled by qubit 0')).toBeTruthy();
  });

  it('selects a placed gate when nothing is armed', async () => {
    await renderEditor();
    await fireEvent.press(screen.getByTestId('palette-X'));
    await fireEvent.press(screen.getByTestId('canvas-cell-1-0'));
    await fireEvent.press(screen.getByTestId('palette-X')); // disarm
    await fireEvent.press(screen.getByTestId('canvas-cell-1-0'));
    expect(editor().selectedId).toBe(editor().gates[0].id);
    expect(screen.getByTestId('selection-ring')).toBeTruthy();
    expect(screen.getByTestId('canvas-cell-1-0')).toBeSelected();
  });
});

describe('labels', () => {
  it('describes cells and the circuit', () => {
    const cx = { id: 'a', type: 'CX' as const, qubit: 2, control: 0, column: 0 };
    expect(cellLabel(null, 0, 2)).toBe('Qubit 0, step 3, empty');
    expect(cellLabel(cx, 0, 0)).toBe('Qubit 0, step 1, CNOT control for qubit 2');
    expect(cellLabel(cx, 1, 0)).toBe('Qubit 1, step 1, crossed by CNOT');
    expect(circuitSummary(1, [])).toBe('Circuit with 1 qubit and 0 gates.');
  });
});
