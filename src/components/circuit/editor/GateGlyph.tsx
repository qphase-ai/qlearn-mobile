import { memo } from 'react';
import { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';

import { GateColors, Radii } from '@/constants/theme';
import { formatAngle, GATES, isTwoQubitGate } from '@/features/circuit/editor/gates';
import { cellCenter, GRID } from '@/features/circuit/editor/geometry';
import type { EditorGate, GateType } from '@/features/circuit/editor/types';

/** SVG drawing of one editor gate, in canvas coordinates (see `geometry.ts`). */

const gateFill = (type: GateType) => GateColors[GATES[type].colorKey];
const labelFill = (type: GateType) => (type === 'M' ? GateColors.labelOnLight : GateColors.label);

/** CX/CZ draw their target as the X/Z they apply, like the read-only diagram. */
function bodyLabel(type: GateType): string {
  if (type === 'CX') return 'X';
  if (type === 'CZ') return 'Z';
  return GATES[type].symbol;
}

interface GateGlyphProps {
  gate: EditorGate;
  selected: boolean;
  /** Selection ring color (theme accent), passed in so the glyph stays theme-free. */
  ringColor: string;
  /** Faded while a lifted copy of the gate is being dragged. */
  dimmed?: boolean;
}

/** Opacity of a gate while its lifted copy is dragged. */
export const DIMMED_OPACITY = 0.3;

/** One gate's drawing. Memoized: an edit only redraws the gates it changed. */
export const GateGlyph = memo(function GateGlyph({ gate, selected, ringColor, dimmed = false }: GateGlyphProps) {
  const { type, qubit, column, control } = gate;
  const fill = gateFill(type);
  const target = cellCenter(qubit, column);
  const half = GRID.GATE / 2;
  const twoQubit = control !== undefined && isTwoQubitGate(type);
  const other = twoQubit ? cellCenter(control, column) : null;
  const angle = gate.params?.theta !== undefined ? formatAngle(gate.params.theta) : null;
  const label = bodyLabel(type);

  const box = (y: number, key: string) => (
    <G key={key}>
      <Rect x={target.x - half} y={y - half} width={GRID.GATE} height={GRID.GATE} rx={Radii.sm} fill={fill} />
      <SvgText
        x={target.x}
        y={angle ? y - 2 : y + 4}
        fontSize={label.length > 2 ? 10 : 13}
        fontWeight="700"
        fill={labelFill(type)}
        textAnchor="middle">
        {label}
      </SvgText>
      {angle ? (
        <SvgText x={target.x} y={y + 12} fontSize={9} fill={labelFill(type)} textAnchor="middle">
          {angle}
        </SvgText>
      ) : null}
    </G>
  );

  const cross = (y: number, key: string) => (
    <G key={key}>
      <Line x1={target.x - 7} y1={y - 7} x2={target.x + 7} y2={y + 7} stroke={fill} strokeWidth={2.5} />
      <Line x1={target.x - 7} y1={y + 7} x2={target.x + 7} y2={y - 7} stroke={fill} strokeWidth={2.5} />
    </G>
  );

  let body: React.ReactNode;
  if (!other) body = box(target.y, 't');
  else if (type === 'SWAP') body = [cross(other.y, 'c'), cross(target.y, 't')];
  else if (type === 'CX' || type === 'CZ')
    body = [<Circle key="c" cx={other.x} cy={other.y} r={6} fill={fill} />, box(target.y, 't')];
  else body = [box(other.y, 'c'), box(target.y, 't')];

  const top = Math.min(target.y, other?.y ?? target.y);
  const bottom = Math.max(target.y, other?.y ?? target.y);
  return (
    <G opacity={dimmed ? DIMMED_OPACITY : 1} testID={dimmed ? 'gate-dimmed' : undefined}>
      {other ? <Line x1={target.x} y1={top} x2={target.x} y2={bottom} stroke={fill} strokeWidth={2} /> : null}
      {body}
      {selected ? (
        <Rect
          x={target.x - half - 4}
          y={top - half - 4}
          width={GRID.GATE + 8}
          height={bottom - top + GRID.GATE + 8}
          rx={Radii.md}
          fill="none"
          stroke={ringColor}
          strokeWidth={2.5}
          testID="selection-ring"
        />
      ) : null}
    </G>
  );
});
