import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Button } from '@/components/ui';
import { fromCircuitSpec, toCircuitSpec } from '@/features/circuit/editor/serialize';
import { useTheme } from '@/hooks/use-theme';
import { SHOT_OPTIONS, useCircuitEditorStore, type Shots } from '@/stores/circuit-editor-store';
import type { CircuitSpec } from '@/types/contracts';

/** Whether the editor already holds exactly this circuit (re-opening it replaces nothing). */
function alreadyOpen(spec: CircuitSpec): boolean {
  const imported = fromCircuitSpec(spec, () => '');
  if (!imported.ok) return false;
  const current = useCircuitEditorStore.getState().spec();
  return JSON.stringify(toCircuitSpec(imported.circuit)) === JSON.stringify(current);
}

/**
 * Copies a lesson circuit into the Build tab's editor and opens it. Undo
 * history is per session (not saved), so replacing a draft that has gates is
 * confirmed first. Gates the editor can't represent are left out, and the
 * student is told how many once Build is open. A simulation's shot count
 * comes along when it is one the builder offers.
 */
export function OpenInBuilder({
  spec,
  title,
  shots,
}: {
  spec: CircuitSpec;
  title?: string | null;
  shots?: number;
}) {
  const theme = useTheme();

  const open = () => {
    const { loadSpec, setShots } = useCircuitEditorStore.getState();
    const result = loadSpec(spec, title || 'Lesson circuit');
    if (!result.ok) {
      Alert.alert("Can't open this circuit", result.error);
      return;
    }
    if (shots !== undefined && SHOT_OPTIONS.includes(shots as Shots)) setShots(shots as Shots);
    router.navigate('/build');
    if (result.skipped > 0) {
      const n = result.skipped;
      Alert.alert(
        'Some gates were left out',
        `${n} gate${n === 1 ? '' : 's'} couldn't be opened in the builder, so the circuit there is incomplete.`,
      );
    }
  };

  const onPress = () => {
    const hasDraft = useCircuitEditorStore.getState().gates.length > 0;
    if (!hasDraft || alreadyOpen(spec)) {
      open();
      return;
    }
    Alert.alert('Replace your current circuit?', 'The circuit in Build will be swapped for this one.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Replace', style: 'destructive', onPress: open },
    ]);
  };

  return (
    <Button
      label="Open in Build"
      variant="ghost"
      icon={<Ionicons name="construct-outline" size={16} color={theme.primary} />}
      onPress={onPress}
    />
  );
}
