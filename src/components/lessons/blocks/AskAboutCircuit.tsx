import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { Button } from '@/components/ui';
import { circuitSpecToQiskitSource } from '@/features/circuit/qiskit';
import { useTheme } from '@/hooks/use-theme';
import { useTutorStore } from '@/stores/tutor-store';
import type { CircuitSpec } from '@/types/contracts';

/** Opens the AI Tutor with this circuit attached as `circuit_context` (Qiskit source). */
export function AskAboutCircuit({ spec, title }: { spec: CircuitSpec; title?: string | null }) {
  const theme = useTheme();
  const setContext = useTutorStore((s) => s.setContext);
  return (
    <Button
      label="Ask the tutor about this circuit"
      variant="ghost"
      icon={<Ionicons name="sparkles-outline" size={16} color={theme.primary} />}
      onPress={() => {
        setContext({ kind: 'circuit', title: title || 'Lesson circuit', source: circuitSpecToQiskitSource(spec) });
        router.navigate('/tutor');
      }}
    />
  );
}
