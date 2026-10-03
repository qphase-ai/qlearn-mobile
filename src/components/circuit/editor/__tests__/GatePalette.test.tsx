import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { GatePalette, paletteStatus } from '../GatePalette';
import { editor, resetEditorStore } from './test-utils';

beforeEach(resetEditorStore);
afterEach(() => jest.restoreAllMocks());

describe('GatePalette', () => {
  it('arms a gate, explains the next step, and disarms on a second tap', async () => {
    await render(<GatePalette />);
    expect(screen.getByTestId('palette-status')).toHaveTextContent(/Pick a gate/);

    await fireEvent.press(screen.getByTestId('palette-H'));
    expect(editor().armed).toBe('H');
    expect(screen.getByTestId('palette-H')).toBeSelected();
    expect(screen.getByTestId('palette-status')).toHaveTextContent(/Tap a wire to place H/);

    await fireEvent.press(screen.getByTestId('palette-H'));
    expect(editor().armed).toBeNull();
    expect(screen.getByTestId('palette-H')).not.toBeSelected();
  });

  it('shows the More gates on demand and keeps an armed one visible', async () => {
    await render(<GatePalette />);
    expect(screen.queryByTestId('palette-RX')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'More gates' }));
    await fireEvent.press(screen.getByTestId('palette-RX'));
    expect(editor().armed).toBe('RX');
    expect(screen.getByTestId('palette-RX')).toBeSelected();
    // Collapsing hides the armed chip, so it also stops placing it.
    await fireEvent.press(screen.getByRole('button', { name: 'Fewer gates' }));
    expect(editor().armed).toBeNull();
    expect(screen.queryByTestId('palette-RX')).toBeNull();
  });

  it('keeps the row open when a main gate is armed and the More gates are collapsed', async () => {
    await render(<GatePalette />);
    await fireEvent.press(screen.getByTestId('palette-H'));
    await fireEvent.press(screen.getByRole('button', { name: 'More gates' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Fewer gates' }));
    expect(editor().armed).toBe('H');
  });

  it('announces each new step to screen-reader users', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    await render(<GatePalette />);
    await act(async () => {});
    expect(announce).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('palette-CX'));
    expect(announce).toHaveBeenLastCalledWith('Tap the control qubit for CNOT');
  });

  it('words each placement step', () => {
    expect(paletteStatus('CX', null)).toBe('Tap the control qubit for CNOT');
    expect(paletteStatus('CX', { qubit: 0, column: 0 })).toMatch(/^Now tap the target qubit/);
    expect(paletteStatus('SWAP', null)).toBe('Tap the first qubit for SWAP');
    expect(paletteStatus('SWAP', { qubit: 0, column: 0 })).toMatch(/^Now tap the second qubit/);
  });
});
