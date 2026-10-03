import { DEFAULT_NAME, DEFAULT_SHOTS, useCircuitEditorStore } from '@/stores/circuit-editor-store';

const initial = useCircuitEditorStore.getState();

const kv = jest.requireMock('expo-sqlite/kv-store').default as { removeItem: (key: string) => Promise<void> };

/** Reset the real editor store to an empty draft and drop the autosaved copy. */
export async function resetEditorStore() {
  useCircuitEditorStore.setState(
    {
      ...initial,
      qubitCount: 2,
      gates: [],
      name: DEFAULT_NAME,
      shots: DEFAULT_SHOTS,
      selectedId: null,
      armed: null,
      pendingControl: null,
      past: [],
      future: [],
    },
    true,
  );
  await kv.removeItem('qlearn.circuit-draft');
}

export const editor = () => useCircuitEditorStore.getState();
