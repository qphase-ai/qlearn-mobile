import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { resetEditorStore } from '@/components/circuit/editor/__tests__/test-utils';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';
import type { CircuitSpec } from '@/types/contracts';

import { OpenInBuilder } from '../blocks/OpenInBuilder';

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `gate-${++n}` };
});

const bell: CircuitSpec = {
  qubits: 2,
  classical_bits: 2,
  gates: [
    { type: 'H', targets: [0] },
    { type: 'CNOT', control: 0, targets: [1] },
  ],
};

beforeEach(async () => {
  await resetEditorStore();
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

describe('OpenInBuilder', () => {
  it('loads the lesson circuit into the editor and opens Build', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await render(<OpenInBuilder spec={bell} title="Bell pair" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Build' }));
    const state = useCircuitEditorStore.getState();
    expect(state.name).toBe('Bell pair');
    expect(state.spec().gates).toEqual([
      { type: 'H', targets: [0] },
      { type: 'CX', control: 0, targets: [1] },
    ]);
    expect(alert).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('/build');
  });

  it('names an untitled circuit and reports gates it left out', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    const spec: CircuitSpec = { ...bell, gates: [...bell.gates, { type: 'TOFFOLI', targets: [1] }] };
    await render(<OpenInBuilder spec={spec} title={null} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Build' }));
    expect(useCircuitEditorStore.getState().name).toBe('Lesson circuit');
    expect(alert).toHaveBeenCalledWith('Some gates were left out', expect.stringMatching(/^1 gate couldn't/));
    expect(router.navigate).toHaveBeenCalledWith('/build');
  });

  it('stays put when the circuit cannot be opened', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    await render(<OpenInBuilder spec={{ qubits: 12, classical_bits: 12, gates: [] }} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Open in Build' }));
    expect(alert).toHaveBeenCalledWith("Can't open this circuit", expect.stringMatching(/more than 8 qubits/));
    expect(router.navigate).not.toHaveBeenCalled();
    expect(useCircuitEditorStore.getState().gates).toEqual([]);
  });
});
