import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { MonoFont, Radii, Spacing } from '@/constants/theme';
import { probabilityRows, stateRows } from '@/features/circuit/results';
import { useTheme } from '@/hooks/use-theme';
import type { SimulationResult } from '@/types/contracts';

export function ProbabilityBars({ result }: { result: SimulationResult }) {
  const theme = useTheme();
  const rows = probabilityRows(result);
  if (rows.length === 0) return <Text color="muted">No measurement probabilities were returned.</Text>;
  return (
    <View style={styles.list} accessibilityLabel="Measurement probabilities">
      {rows.map((row) => (
        <View
          key={row.label}
          style={styles.row}
          accessible
          accessibilityLabel={`${row.label.replace(/[|⟩]/g, '')}: ${row.percent} percent`}>
          <Text variant="label" style={styles.basis}>
            {row.label}
          </Text>
          <View style={[styles.track, { backgroundColor: theme.overlay }]}>
            <View
              style={[styles.fill, { width: `${Math.min(100, row.probability * 100)}%`, backgroundColor: theme.primary }]}
            />
          </View>
          <Text variant="label" style={styles.pct}>
            {row.percent}%
          </Text>
        </View>
      ))}
    </View>
  );
}

export function StatevectorList({ result }: { result: SimulationResult }) {
  const theme = useTheme();
  const rows = stateRows(result);
  if (rows.length === 0) return <Text color="muted">No state vector was returned.</Text>;
  const header = ['State', 'Amplitude', 'Prob.', 'Phase'];
  return (
    <View style={[styles.table, { borderColor: theme.border }]}>
      {[header, ...rows.map((r) => [r.label, r.amplitude, r.probability, r.phase])].map((cells, i) => (
        <View
          key={i}
          style={[styles.tableRow, { borderColor: theme.border }, i === 0 && { backgroundColor: theme.overlay }]}>
          {cells.map((cell, c) => (
            <Text key={c} variant="label" color={i === 0 ? 'muted' : 'foreground'} style={styles.cell}>
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  basis: { width: 56, fontFamily: MonoFont },
  track: { flex: 1, height: 14, borderRadius: Radii.sm, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radii.sm },
  pct: { width: 44, textAlign: 'right' },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.sm, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  cell: { flex: 1, padding: Spacing.sm, fontFamily: MonoFont, fontSize: 13 },
});
