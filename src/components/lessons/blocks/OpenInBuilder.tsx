import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';
import type { CircuitSpec } from '@/types/contracts';

/**
 * Copies a lesson circuit into the Build tab's editor and opens it. The
 * circuit it replaces stays one undo away. Gates the editor can't represent
 * are left out, and the student is told how many.
 */
export function OpenInBuilder({ spec, title }: { spec: CircuitSpec; title?: string | null }) {
  const theme = useTheme();
  const loadSpec = useCircuitEditorStore((s) => s.loadSpec);
  return (
    <Button
      label="Open in Build"
      variant="ghost"
      icon={<Ionicons name="construct-outline" size={16} color={theme.primary} />}
      onPress={() => {
        const result = loadSpec(spec, title || 'Lesson circuit');
        if (!result.ok) {
          Alert.alert("Can't open this circuit", result.error);
          return;
        }
        if (result.skipped > 0) {
          const n = result.skipped;
          Alert.alert(
            'Some gates were left out',
            `${n} gate${n === 1 ? '' : 's'} couldn't be opened in the builder, so the circuit there is incomplete.`,
          );
        }
        router.navigate('/build');
      }}
    />
  );
}
