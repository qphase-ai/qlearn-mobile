import { memo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { GateColors, MIN_TOUCH, Radii, Spacing } from '@/constants/theme';
import { GATES, isTwoQubitGate, MAIN_GATES, MORE_GATES } from '@/features/circuit/editor/gates';
import type { GateType } from '@/features/circuit/editor/types';
import { useTheme } from '@/hooks/use-theme';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

/** CNOT/CZ have a control; the other two-qubit gates just act on two qubits. */
const hasControl = (type: GateType) => type === 'CX' || type === 'CZ';

/** The next step of the tap-to-place flow, in words. */
export function paletteStatus(armed: GateType | null, pendingControl: unknown): string {
  if (!armed) return 'Pick a gate, then tap a wire to place it. Tap a placed gate to edit it.';
  const { name, symbol } = GATES[armed];
  if (!isTwoQubitGate(armed)) return `Tap a wire to place ${symbol}. Tap ${symbol} again when you're done.`;
  if (!pendingControl) return hasControl(armed) ? `Tap the control qubit for ${name}` : `Tap the first qubit for ${name}`;
  return hasControl(armed)
    ? 'Now tap the target qubit (same wire to cancel)'
    : 'Now tap the second qubit (same wire to cancel)';
}

const GateChip = memo(function GateChip({
  type,
  armed,
  onPress,
}: {
  type: GateType;
  armed: boolean;
  onPress: (type: GateType) => void;
}) {
  const theme = useTheme();
  const def = GATES[type];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${def.name} gate`}
      accessibilityHint={armed ? 'Stops placing this gate' : 'Choose, then tap a wire to place it'}
      accessibilityState={{ selected: armed }}
      testID={`palette-${type}`}
      onPress={() => onPress(type)}
      style={[
        styles.chip,
        { borderColor: armed ? theme.primary : theme.border, backgroundColor: armed ? theme.overlay : theme.surface },
      ]}>
      <View style={[styles.swatch, { backgroundColor: GateColors[def.colorKey] }]}>
        <Text
          variant="label"
          style={[styles.symbol, { color: type === 'M' ? GateColors.labelOnLight : GateColors.label }]}
          numberOfLines={1}
          adjustsFontSizeToFit>
          {def.symbol}
        </Text>
      </View>
    </Pressable>
  );
});

export function GatePalette() {
  const theme = useTheme();
  const armed = useCircuitEditorStore((s) => s.armed);
  const pendingControl = useCircuitEditorStore((s) => s.pendingControl);
  const arm = useCircuitEditorStore((s) => s.arm);
  const [moreOpen, setMoreOpen] = useState(false);
  // An armed "More" gate keeps its row visible.
  const showMore = moreOpen || (armed !== null && MORE_GATES.includes(armed));

  return (
    <View style={styles.root}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {MAIN_GATES.map((type) => (
          <GateChip key={type} type={type} armed={armed === type} onPress={arm} />
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={showMore ? 'Fewer gates' : 'More gates'}
          accessibilityState={{ expanded: showMore }}
          onPress={() => setMoreOpen(!showMore)}
          style={[styles.more, { borderColor: theme.border }]}>
          <Text variant="label" color="primary">
            {showMore ? 'Less' : 'More'}
          </Text>
        </Pressable>
      </ScrollView>
      {showMore ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {MORE_GATES.map((type) => (
            <GateChip key={type} type={type} armed={armed === type} onPress={arm} />
          ))}
        </ScrollView>
      ) : null}
      <Text variant="caption" color="muted" accessibilityLiveRegion="polite" testID="palette-status">
        {paletteStatus(armed, pendingControl)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  row: { gap: Spacing.sm, alignItems: 'center' },
  chip: {
    minWidth: MIN_TOUCH + 4,
    minHeight: MIN_TOUCH + 4,
    borderRadius: Radii.md,
    borderWidth: 1.5,
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatch: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: Spacing.xs,
    borderRadius: Radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: { fontWeight: '700' },
  more: {
    minHeight: MIN_TOUCH + 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
});
