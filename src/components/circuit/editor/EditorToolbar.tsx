import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { MIN_TOUCH, Radii, Spacing, Typography } from '@/constants/theme';
import { gateRows } from '@/features/circuit/editor/model';
import { MAX_QUBITS, MIN_QUBITS } from '@/features/circuit/editor/types';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

import { IconButton } from './IconButton';

/** Name the circuit; edits are committed on submit or blur. */
function NameField() {
  const theme = useTheme();
  const name = useCircuitEditorStore((s) => s.name);
  const rename = useCircuitEditorStore((s) => s.rename);
  const [draft, setDraft] = useState(name);
  const [shown, setShown] = useState(name);
  // A load/undo changes the stored name: show it instead of the stale draft.
  if (shown !== name) {
    setShown(name);
    setDraft(name);
  }
  const commit = () => {
    rename(draft);
    // rename may clean the text (or keep the same name): show what was stored.
    setDraft(useCircuitEditorStore.getState().name);
  };

  return (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onSubmitEditing={commit}
      onBlur={commit}
      accessibilityLabel="Circuit name"
      returnKeyType="done"
      maxLength={80}
      placeholderTextColor={theme.muted}
      style={[styles.name, Typography.heading, { color: theme.foreground, borderColor: theme.border }]}
      testID="circuit-name"
    />
  );
}

export function EditorToolbar({
  onShowTemplates,
  templatesDisabled = false,
}: {
  onShowTemplates: () => void;
  /** True while the examples are already on screen (empty circuit). */
  templatesDisabled?: boolean;
}) {
  const qubitCount = useCircuitEditorStore((s) => s.qubitCount);
  const canUndo = useCircuitEditorStore((s) => s.past.length > 0);
  const canRedo = useCircuitEditorStore((s) => s.future.length > 0);
  const hasGates = useCircuitEditorStore((s) => s.gates.length > 0);
  const setQubitCount = useCircuitEditorStore((s) => s.setQubitCount);
  const undo = useCircuitEditorStore((s) => s.undo);
  const redo = useCircuitEditorStore((s) => s.redo);
  const clear = useCircuitEditorStore((s) => s.clear);

  /** Dropping the last wire deletes the gates on it, so ask first. */
  const removeQubit = () => {
    const { gates, qubitCount: count } = useCircuitEditorStore.getState();
    const last = count - 1;
    const doomed = gates.filter((g) => gateRows(g).includes(last)).length;
    if (doomed === 0) {
      setQubitCount(count - 1);
      return;
    }
    Alert.alert(`Remove qubit q${last}?`, `This deletes ${doomed} gate${doomed === 1 ? '' : 's'}. You can undo it.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setQubitCount(count - 1) },
    ]);
  };

  const confirmClear = () =>
    Alert.alert('Clear the circuit?', 'This removes every gate. You can undo it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clear },
    ]);

  return (
    <View style={styles.root}>
      <NameField />
      <View style={styles.row}>
        <View style={styles.stepper}>
          <IconButton
            icon="remove"
            label="Remove a qubit"
            disabled={qubitCount <= MIN_QUBITS}
            onPress={removeQubit}
          />
          <Text variant="label" style={styles.count} testID="qubit-count">
            {`${qubitCount} qubit${qubitCount === 1 ? '' : 's'}`}
          </Text>
          <IconButton
            icon="add"
            label="Add a qubit"
            disabled={qubitCount >= MAX_QUBITS}
            onPress={() => setQubitCount(qubitCount + 1)}
          />
        </View>
        <View style={styles.actions}>
          <IconButton icon="arrow-undo" label="Undo" disabled={!canUndo} onPress={undo} />
          <IconButton icon="arrow-redo" label="Redo" disabled={!canRedo} onPress={redo} />
          <IconButton icon="albums-outline" label="Examples" disabled={templatesDisabled} onPress={onShowTemplates} />
          <IconButton icon="trash-outline" label="Clear circuit" disabled={!hasGates} onPress={confirmClear} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  name: {
    minHeight: MIN_TOUCH,
    borderBottomWidth: 1,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.xs,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  count: { minWidth: 64, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.xs },
});
