import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, DeviceEventEmitter } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { cellCenter, GRID } from '@/features/circuit/editor/geometry';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

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

describe('canvas tap gesture', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  });

  const tapAt = async (from: { x: number; y: number }, to = from) => {
    await act(async () => {
      fireGestureHandler(getByGestureTestId('canvas-tap'), [
        { state: State.BEGAN, x: from.x, y: from.y },
        { state: State.ACTIVE, x: to.x, y: to.y },
        { state: State.END, x: to.x, y: to.y },
      ]);
    });
  };

  it('places the armed gate in the tapped cell', async () => {
    await renderEditor();
    await fireEvent.press(screen.getByTestId('palette-H'));
    const { x, y } = cellCenter(1, 2);
    await tapAt({ x: x + 3, y: y - 2 }, { x: x + 5, y: y + 2 });
    expect(editor().gates).toMatchObject([{ type: 'H', qubit: 1, column: 2 }]);
  });

  it('ignores a touch that moved too far to be a tap', async () => {
    await renderEditor();
    await fireEvent.press(screen.getByTestId('palette-H'));
    await tapAt(cellCenter(0, 0), cellCenter(1, 3));
    expect(editor().gates).toEqual([]);
  });

  it('is limited to short, still touches', async () => {
    await renderEditor();
    const { config } = getByGestureTestId('canvas-tap') as unknown as { config: Record<string, unknown> };
    expect(config).toMatchObject({ enabled: true, maxDist: 10, maxDurationMs: 300 });
  });

  it('is disabled while the screen-reader cells are shown', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await renderEditor();
    const { config } = getByGestureTestId('canvas-tap') as unknown as { config: Record<string, unknown> };
    expect(config.enabled).toBe(false);
  });
});

describe('canvas drag gesture', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
  });

  const config = (testId: string) =>
    (getByGestureTestId(testId) as unknown as { config: Record<string, unknown> }).config;

  /**
   * Long-press the cell (q, c) and drag by (dx, dy). The jest utilities emit
   * the handler's events directly, so the 250 ms hold is not simulated: ACTIVE
   * stands for "the long press elapsed".
   */
  const dragFrom = async (q: number, c: number, dx: number, dy: number) => {
    const { x, y } = cellCenter(q, c);
    const at = (tx: number, ty: number) => ({ x: x + tx, y: y + ty, translationX: tx, translationY: ty });
    await act(async () => {
      fireGestureHandler(getByGestureTestId('canvas-drag'), [
        { state: State.BEGAN, ...at(0, 0) },
        { state: State.ACTIVE, ...at(0, 0) },
        { state: State.ACTIVE, ...at(dx, dy) },
        { state: State.END, ...at(dx, dy) },
      ]);
    });
  };

  /**
   * Drive the drag event by event (as fireGestureHandler does), to look at
   * the canvas or change the store mid-drag.
   */
  const manualDrag = (q: number, c: number) => {
    const { x, y } = cellCenter(q, c);
    const at = (tx: number, ty: number) => ({ x: x + tx, y: y + ty, translationX: tx, translationY: ty });
    const emit = (name: string, e: Record<string, unknown>) =>
      act(async () => {
        const { handlerTag } = getByGestureTestId('canvas-drag');
        DeviceEventEmitter.emit(name, { handlerTag, numberOfPointers: 1, ...e });
      });
    return {
      begin: async () => {
        await emit('onGestureHandlerStateChange', { state: State.BEGAN, oldState: State.UNDETERMINED, ...at(0, 0) });
        await emit('onGestureHandlerStateChange', { state: State.ACTIVE, oldState: State.BEGAN, ...at(0, 0) });
      },
      moveTo: (tx: number, ty: number) => emit('onGestureHandlerEvent', { state: State.ACTIVE, ...at(tx, ty) }),
      end: (tx: number, ty: number) =>
        emit('onGestureHandlerStateChange', { state: State.END, oldState: State.ACTIVE, ...at(tx, ty) }),
    };
  };

  it('is a pan that activates after a 250 ms long press, beside the tap', async () => {
    useCircuitEditorStore.setState({ gates: [{ id: 'h', type: 'H', qubit: 0, column: 0 }] });
    await renderEditor();
    expect(config('canvas-drag')).toMatchObject({ enabled: true, activateAfterLongPress: 250, maxPointers: 1 });
    expect(config('canvas-tap').enabled).toBe(true);
  });

  it('is disabled while a gate is armed (placement mode)', async () => {
    await renderEditor();
    await fireEvent.press(screen.getByTestId('palette-H'));
    expect(config('canvas-drag').enabled).toBe(false);
  });

  it('is disabled while the screen-reader cells are shown', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    await renderEditor();
    expect(config('canvas-drag').enabled).toBe(false);
  });

  it('moves a long-pressed gate to the cell it is dropped on and selects it', async () => {
    useCircuitEditorStore.setState({
      gates: [
        { id: 'h', type: 'H', qubit: 0, column: 0 },
        { id: 'cx', type: 'CX', qubit: 1, control: 0, column: 1 },
      ],
    });
    await renderEditor();
    await dragFrom(0, 0, 2 * GRID.COL_W + 10, GRID.ROW_H - 12);
    expect(editor().gates[0]).toMatchObject({ id: 'h', qubit: 1, column: 2 });
    expect(editor().selectedId).toBe('h');
    expect(editor().past).toHaveLength(1);
    expect(screen.queryByTestId('lifted-gate')).toBeNull();
    expect(screen.queryByTestId('gate-dimmed')).toBeNull();
  });

  it('moves a two-qubit gate by its crossed row, keeping the control offset', async () => {
    useCircuitEditorStore.setState({ qubitCount: 3, gates: [{ id: 'cx', type: 'CX', qubit: 2, control: 0, column: 0 }] });
    await renderEditor();
    await dragFrom(1, 0, GRID.COL_W, 0); // grab the middle (crossed) row
    expect(editor().gates[0]).toMatchObject({ qubit: 2, control: 0, column: 1 });
  });

  it('lifts the gate and highlights the drop cell while dragging', async () => {
    useCircuitEditorStore.setState({
      gates: [
        { id: 'h', type: 'H', qubit: 0, column: 0 },
        { id: 'x', type: 'X', qubit: 1, column: 0 },
      ],
    });
    await renderEditor();
    const drag = manualDrag(0, 0);
    await drag.begin();
    await drag.moveTo(GRID.COL_W, 0);
    expect(screen.getByTestId('lifted-gate')).toBeTruthy();
    expect(screen.getByTestId('gate-dimmed')).toBeTruthy();
    expect(screen.getByTestId('drop-target')).toBeTruthy();
    expect(screen.getByTestId('canvas-scroll-horizontal').props.scrollEnabled).toBe(false);
    expect(screen.getByTestId('canvas-scroll-vertical').props.scrollEnabled).toBe(false);

    await drag.moveTo(0, GRID.ROW_H); // onto the X
    expect(screen.getByTestId('drop-target-invalid')).toBeTruthy();
    expect(screen.queryByTestId('drop-target')).toBeNull();

    await drag.moveTo(-3 * GRID.COL_W, 0); // off the grid
    expect(screen.queryByTestId('drop-target-invalid')).toBeNull();
    expect(screen.queryByTestId('drop-target')).toBeNull();

    await drag.end(GRID.COL_W, 0);
    expect(editor().gates[0]).toMatchObject({ id: 'h', qubit: 0, column: 1 });
    expect(screen.getByTestId('canvas-scroll-horizontal').props.scrollEnabled).toBe(true);
  });

  it('highlights every row a two-qubit gate would cover', async () => {
    useCircuitEditorStore.setState({ qubitCount: 3, gates: [{ id: 'cx', type: 'CX', qubit: 1, control: 0, column: 0 }] });
    await renderEditor();
    const drag = manualDrag(1, 0);
    await drag.begin();
    await drag.moveTo(GRID.COL_W, GRID.ROW_H); // target q2, control q1, step 2
    const rect = screen.getByTestId('drop-target').props;
    expect(rect.height).toBe(2 * GRID.ROW_H - 4);
    expect(rect.y).toBe(cellCenter(1, 1).y - GRID.ROW_H / 2 + 2);
    await drag.end(GRID.COL_W, GRID.ROW_H);
    expect(editor().gates[0]).toMatchObject({ qubit: 2, control: 1, column: 1 });
  });

  it('keeps dragging the same gate when an earlier gate is removed mid-drag', async () => {
    useCircuitEditorStore.setState({
      gates: [
        { id: 'a', type: 'X', qubit: 1, column: 0 },
        { id: 'h', type: 'H', qubit: 0, column: 1 },
      ],
    });
    await renderEditor();
    const drag = manualDrag(0, 1);
    await drag.begin();
    await drag.moveTo(GRID.COL_W / 2, 0);
    await act(async () => {
      useCircuitEditorStore.setState({ gates: editor().gates.filter((g) => g.id !== 'a') });
    });
    await drag.moveTo(GRID.COL_W, 0);
    await drag.end(GRID.COL_W, 0);
    expect(editor().gates).toEqual([{ id: 'h', type: 'H', qubit: 0, column: 2 }]);
    expect(editor().selectedId).toBe('h');
  });

  it('moves nothing when the dragged gate is removed mid-drag', async () => {
    useCircuitEditorStore.setState({
      gates: [
        { id: 'h', type: 'H', qubit: 0, column: 0 },
        { id: 'x', type: 'X', qubit: 1, column: 1 },
      ],
    });
    await renderEditor();
    const drag = manualDrag(0, 0);
    await drag.begin();
    await drag.moveTo(GRID.COL_W, 0);
    await act(async () => {
      useCircuitEditorStore.setState({ gates: editor().gates.filter((g) => g.id !== 'h') });
    });
    expect(screen.queryByTestId('lifted-gate')).toBeNull();
    expect(screen.getByTestId('canvas-scroll-horizontal').props.scrollEnabled).toBe(false); // still dragging
    await drag.moveTo(GRID.COL_W, GRID.ROW_H);
    await drag.end(GRID.COL_W, GRID.ROW_H);
    expect(editor().gates).toEqual([{ id: 'x', type: 'X', qubit: 1, column: 1 }]);
    expect(editor().selectedId).toBeNull();
    await waitFor(() => expect(screen.getByTestId('canvas-scroll-horizontal').props.scrollEnabled).toBe(true), {
      timeout: 3000,
    });
  });

  it('springs back and leaves the circuit unchanged on a rejected drop', async () => {
    useCircuitEditorStore.setState({
      gates: [
        { id: 'h', type: 'H', qubit: 0, column: 0 },
        { id: 'x', type: 'X', qubit: 1, column: 0 },
      ],
    });
    await renderEditor();
    const before = editor().gates;
    await dragFrom(0, 0, 0, GRID.ROW_H); // onto the X
    expect(editor().gates).toBe(before);
    expect(editor().past).toHaveLength(0);
    // The lifted copy stays until it has sprung back, and the scroll views stay locked.
    expect(screen.getByTestId('lifted-gate')).toBeTruthy();
    expect(screen.getByTestId('canvas-scroll-horizontal').props.scrollEnabled).toBe(false);
    // Real (short) animation frames: fake timers can't advance Reanimated's frame clock.
    await waitFor(() => expect(screen.queryByTestId('lifted-gate')).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId('canvas-scroll-horizontal').props.scrollEnabled).toBe(true);
  });

  it('springs back when dropped off the grid', async () => {
    useCircuitEditorStore.setState({ gates: [{ id: 'h', type: 'H', qubit: 0, column: 0 }] });
    await renderEditor();
    await dragFrom(0, 0, -2 * GRID.COL_W, 0);
    expect(editor().gates[0]).toMatchObject({ qubit: 0, column: 0 });
    expect(editor().past).toHaveLength(0);
    await waitFor(() => expect(screen.queryByTestId('lifted-gate')).toBeNull(), { timeout: 3000 });
  });

  it('selects the gate when it is dropped back on its own cell', async () => {
    useCircuitEditorStore.setState({ gates: [{ id: 'h', type: 'H', qubit: 0, column: 0 }] });
    await renderEditor();
    await dragFrom(0, 0, 8, -6);
    expect(editor().selectedId).toBe('h');
    expect(editor().past).toHaveLength(0);
    await waitFor(() => expect(screen.queryByTestId('lifted-gate')).toBeNull(), { timeout: 3000 });
  });

  it('does nothing when the press is not on a gate', async () => {
    useCircuitEditorStore.setState({ gates: [{ id: 'h', type: 'H', qubit: 0, column: 0 }] });
    await renderEditor();
    await dragFrom(1, 1, -GRID.COL_W, -GRID.ROW_H);
    expect(editor().gates[0]).toMatchObject({ qubit: 0, column: 0 });
    expect(editor().selectedId).toBeNull();
    expect(screen.queryByTestId('lifted-gate')).toBeNull();
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
