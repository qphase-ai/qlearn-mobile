import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { GateColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CircuitSpec } from '@/types/contracts';

import { layoutCircuit } from './layout';

/** Read-only circuit diagram (lesson circuit/simulation blocks). */

const LABEL_W = 36;
const ROW_H = 48;
const COL_W = 52;
const GATE = 34;
const PAD = 16;

const ROTATIONS = new Set(['RX', 'RY', 'RZ', 'RXX', 'RYY', 'RZZ']);

export function gateColor(type: string): string {
  const t = type.toUpperCase();
  if (t === 'CNOT' || t === 'CX' || t === 'CZ' || t === 'SWAP') return GateColors.CX;
  if (ROTATIONS.has(t)) return GateColors.rotation;
  if (t === 'U3') return GateColors.U;
  return (GateColors as Record<string, string>)[t] ?? GateColors.I;
}

export const CircuitDiagram = memo(function CircuitDiagram({ spec }: { spec: Pick<CircuitSpec, 'qubits' | 'gates'> }) {
  const theme = useTheme();
  const layout = useMemo(() => layoutCircuit(spec), [spec]);
  const width = LABEL_W + Math.max(1, layout.columns) * COL_W + PAD;
  const height = layout.qubits * ROW_H + PAD;
  const wireY = (q: number) => PAD / 2 + q * ROW_H + ROW_H / 2;
  const gateX = (c: number) => LABEL_W + c * COL_W + COL_W / 2;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, { backgroundColor: theme.elevated, borderColor: theme.border }]}>
      <Svg
        width={width}
        height={height}
        accessibilityLabel={`Circuit with ${layout.qubits} qubit${layout.qubits === 1 ? '' : 's'} and ${layout.gates.length} gate${layout.gates.length === 1 ? '' : 's'}`}
        testID="circuit-diagram">
        {Array.from({ length: layout.qubits }, (_, q) => (
          <G key={`wire-${q}`}>
            <SvgText x={LABEL_W - 8} y={wireY(q) + 4} fontSize={11} fill={theme.muted} textAnchor="end">
              {`q${q}`}
            </SvgText>
            <Line x1={LABEL_W} y1={wireY(q)} x2={width - 4} y2={wireY(q)} stroke={GateColors.wire} strokeWidth={1.5} />
          </G>
        ))}
        {layout.gates.map(({ gate, column, targets, control }, i) => {
          const cx = gateX(column);
          const color = gateColor(gate.type);
          const upper = gate.type.toUpperCase();
          const label = upper === 'CNOT' || upper === 'CX' ? 'X' : upper === 'CZ' ? 'Z' : gate.type;
          const labelColor = upper === 'M' ? GateColors.labelOnLight : GateColors.label;
          return (
            <G key={`gate-${i}`}>
              {control !== null ? (
                <>
                  <Line x1={cx} y1={wireY(control)} x2={cx} y2={wireY(targets[0])} stroke={color} strokeWidth={2} />
                  <Circle cx={cx} cy={wireY(control)} r={5} fill={color} />
                </>
              ) : null}
              {targets.map((t) => (
                <G key={t}>
                  <Rect x={cx - GATE / 2} y={wireY(t) - GATE / 2} width={GATE} height={GATE} rx={6} fill={color} />
                  <SvgText
                    x={cx}
                    y={wireY(t) + 4}
                    fontSize={label.length > 2 ? 10 : 13}
                    fontWeight="700"
                    fill={labelColor}
                    textAnchor="middle">
                    {label}
                  </SvgText>
                </G>
              ))}
            </G>
          );
        })}
      </Svg>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: { borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, flexGrow: 0 },
});
