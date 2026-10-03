import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { EditorToolbar } from '../EditorToolbar';
import { editor, resetEditorStore } from './test-utils';

beforeEach(resetEditorStore);
afterEach(() => jest.restoreAllMocks());

const button = (name: string) => screen.getByRole('button', { name });

describe('EditorToolbar', () => {
  it('steps the qubit count within 1–8', async () => {
    await render(<EditorToolbar onShowTemplates={jest.fn()} />);
    await fireEvent.press(button('Remove a qubit'));
    expect(screen.getByTestId('qubit-count')).toHaveTextContent('1 qubit');
    expect(button('Remove a qubit')).toBeDisabled();

    await act(() => useCircuitEditorStore.setState({ qubitCount: 7 }));
    await fireEvent.press(button('Add a qubit'));
    expect(editor().qubitCount).toBe(8);
    expect(button('Add a qubit')).toBeDisabled();
  });

  it('confirms before removing a qubit that has gates', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    useCircuitEditorStore.setState({
      gates: [
        { id: 'h', type: 'H', qubit: 0, column: 0 },
        { id: 'c', type: 'CX', qubit: 1, control: 0, column: 1 },
      ],
    });
    await render(<EditorToolbar onShowTemplates={jest.fn()} />);
    await fireEvent.press(button('Remove a qubit'));
    expect(editor().qubitCount).toBe(2);
    expect(alert).toHaveBeenCalledWith('Remove qubit q1?', 'This deletes 1 gate. You can undo it.', expect.any(Array));
    const remove = alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!;
    await act(() => remove.onPress!());
    expect(editor().qubitCount).toBe(1);
    expect(editor().gates.map((g) => g.id)).toEqual(['h']);
  });

  it('disables Examples while they are already shown', async () => {
    await render(<EditorToolbar onShowTemplates={jest.fn()} templatesDisabled />);
    expect(button('Examples')).toBeDisabled();
  });

  it('enables undo and redo only when there is history', async () => {
    await render(<EditorToolbar onShowTemplates={jest.fn()} />);
    expect(button('Undo')).toBeDisabled();
    expect(button('Redo')).toBeDisabled();

    await fireEvent.press(button('Add a qubit'));
    expect(button('Undo')).toBeEnabled();
    await fireEvent.press(button('Undo'));
    expect(editor().qubitCount).toBe(2);
    expect(button('Undo')).toBeDisabled();
    expect(button('Redo')).toBeEnabled();
    await fireEvent.press(button('Redo'));
    expect(editor().qubitCount).toBe(3);
  });

  it('confirms before clearing', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    useCircuitEditorStore.setState({ gates: [{ id: 'a', type: 'H', qubit: 0, column: 0 }] });
    await render(<EditorToolbar onShowTemplates={jest.fn()} />);
    await fireEvent.press(button('Clear circuit'));
    expect(editor().gates).toHaveLength(1);
    const buttons = alert.mock.calls[0][2]!;
    const destructive = buttons.find((b) => b.style === 'destructive')!;
    await act(() => destructive.onPress!());
    expect(editor().gates).toEqual([]);
  });

  it('renames the circuit on submit and follows loads', async () => {
    const onShowTemplates = jest.fn();
    await render(<EditorToolbar onShowTemplates={onShowTemplates} />);
    const input = screen.getByTestId('circuit-name');
    await fireEvent.changeText(input, '  My   Bell  ');
    await fireEvent(input, 'submitEditing');
    expect(editor().name).toBe('My Bell');
    expect(input).toHaveDisplayValue('My Bell');

    await fireEvent.press(button('Examples'));
    expect(onShowTemplates).toHaveBeenCalled();
    await act(() => {
      editor().loadTemplate('ghz');
    });
    expect(await screen.findByDisplayValue('GHZ state')).toBeTruthy();
  });
});
