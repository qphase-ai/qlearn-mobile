import { fireEvent, render, screen } from '@testing-library/react-native';

import { GatePalette, paletteStatus } from '../GatePalette';
import { editor, resetEditorStore } from './test-utils';

beforeEach(resetEditorStore);

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
    await fireEvent.press(screen.getByRole('button', { name: 'Fewer gates' }));
    // Still armed, so the row stays open.
    expect(screen.getByTestId('palette-RX')).toBeSelected();
  });

  it('words each placement step', () => {
    expect(paletteStatus('CX', null)).toBe('Tap the control qubit for CNOT');
    expect(paletteStatus('CX', { qubit: 0, column: 0 })).toMatch(/^Now tap the target qubit/);
    expect(paletteStatus('SWAP', null)).toBe('Tap the first qubit for SWAP');
    expect(paletteStatus('SWAP', { qubit: 0, column: 0 })).toMatch(/^Now tap the second qubit/);
  });
});
