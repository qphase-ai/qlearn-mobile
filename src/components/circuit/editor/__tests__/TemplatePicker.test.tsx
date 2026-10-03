import { fireEvent, render, screen } from '@testing-library/react-native';

import { TemplatePicker } from '../TemplatePicker';
import { editor, resetEditorStore } from './test-utils';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `gate-${++n}` };
});

beforeEach(resetEditorStore);

describe('TemplatePicker', () => {
  it('loads an example and closes', async () => {
    const onClose = jest.fn();
    await render(<TemplatePicker onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Bell state example' }));
    expect(editor().name).toBe('Bell state');
    expect(editor().spec()).toEqual({
      qubits: 2,
      classical_bits: 2,
      gates: [
        { type: 'H', targets: [0] },
        { type: 'CX', control: 0, targets: [1] },
        { type: 'M', targets: [0], classical: [0] },
        { type: 'M', targets: [1], classical: [1] },
      ],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('warns that an example replaces a non-empty circuit', async () => {
    editor().loadTemplate('superposition');
    await render(<TemplatePicker />);
    expect(screen.getByText('This replaces your circuit. You can undo it.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hide examples' })).toBeNull();
  });
});
