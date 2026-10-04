# Q-Learn Mobile Phase 5 (Circuit Builder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A touch-first circuit editor in the Build tab. Students place gates on qubit wires, edit parameters, run the circuit on the Q-Learn quantum backend, see the results, and ask the tutor about it. The editor emits **the same canonical `CircuitSpec`** as the web builder, so the backend sees no difference between clients.

**Architecture:** React Flow is not ported. The editor has its own small model (`EditorGate` on a qubit × column grid) with pure, tested operations ported from the web's `circuitStore` placement rules (`frontend/src/stores/circuitStore.ts`, `frontend/src/lib/circuit-spec.ts`). A Zustand store wraps those operations with undo/redo, selection and the tap-to-place interaction state machine, and autosaves the current draft to kv. The canvas is `react-native-svg` with one Gesture Handler tap gesture mapped to cells via pure geometry, not one Pressable per cell. Drag-to-move uses Gesture Handler + Reanimated on the UI thread. Execution reuses Phase 2's `useCircuitRun` (subscribe to `circuit:{id}` → `POST /execute` → Realtime result) and its result views. "Ask the tutor" reuses Phase 4's circuit context.

**Tech Stack:** no new dependencies (`react-native-svg`, `react-native-gesture-handler` and `react-native-reanimated` are already installed).

**Spec:** `docs/architecture-audit.md` §9, §16, §18 (Phase 5)

## Global Constraints

- **Canonical format only.** Output is `CircuitSpec {qubits, classical_bits, gates: GateSpec[]}` exactly as the web serializer produces it (rules in Task 1). No second circuit format crosses the API.
- **Nothing executes on device.** Runs go through `POST /api/v1/circuits/{id}/execute` (existing `useCircuitRun`).
- No new backend endpoints. There is no saved-circuits API, so the current draft persists locally (kv). A saved list is future work (audit §13).
- Bounded rendering: max **8 qubits** (web parity) and **40 columns**. One SVG plus one gesture, no per-cell components (except the screen-reader overlay, Task 3).
- Server state stays in TanStack Query. The editor is genuine client state (Zustand). Colors come from `GateColors`/`useTheme()`, never literals.
- Every task keeps `npm run lint`, `npm run type-check` and `npm test` green. Tests sit next to code in `__tests__/*.test.ts(x)`.

## Shared Definitions (all tasks)

```ts
// src/features/circuit/editor/types.ts
export type GateType =
  | 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'I' | 'SX'
  | 'RX' | 'RY' | 'RZ' | 'P' | 'U' | 'U3'
  | 'CX' | 'CZ' | 'SWAP' | 'RXX' | 'RYY' | 'RZZ'
  | 'M';
export interface GateParams { theta?: number; phi?: number; lambda?: number }
export interface EditorGate {
  id: string;
  type: GateType;
  column: number;        // 0-based
  qubit: number;         // the target qubit
  control?: number;      // second qubit of a two-qubit gate (the control for CX/CZ)
  params?: GateParams;   // only for parametric gates, all keys present
}
export interface EditorCircuit { qubitCount: number; gates: EditorGate[] }
export const MIN_QUBITS = 1, MAX_QUBITS = 8, MAX_COLUMNS = 40;
```

---

### Task 1: Pure circuit domain (no React)
**Files:** `src/features/circuit/editor/{types.ts,gates.ts,model.ts,serialize.ts,validate.ts,templates.ts}` + `__tests__/`

- [x] `gates.ts`: catalog ported from `frontend/src/lib/gates.ts`: `GATES: Record<GateType, GateDef>` with `type, symbol, name, description, category ('single'|'rotation'|'multi'|'measure'), arity (1|2), params: {key,label,default}[], more?: boolean, colorKey: keyof typeof GateColors`. θ default π/2, φ and λ default 0. Params: RX/RY/RZ/P/RXX/RYY/RZZ → [θ]; U/U3 → [θ, φ, λ]. `isGateType`, `isTwoQubitGate`, `defaultParams(type)`, `formatAngle(rad)` (π fractions as on the web, `−` sign), `ANGLE_PRESETS` (π/4, π/2, π, −π/2). Main palette: H X Y Z S T CX CZ SWAP M. "More": I SX RX RY RZ P U U3 RXX RYY RZZ
- [x] `model.ts`: immutable ops returning a new `EditorCircuit` (or `null` when the op is invalid):
  - `gateRows(g)`: every row from min(qubit, control) to max, inclusive
  - `occupied(circuit, ignoreIds?)` → `Set<"q:c">`, and `nextFreeColumn(occupied, rows, from)`
  - `placeGate(c, type, qubit, column, id)`: single-qubit only. If the cell is taken, use the next free column on that row. Null if out of range or past `MAX_COLUMNS`
  - `placeTwoQubitGate(c, type, control, target, column, id)`: null if control === target or out of range. Column = next free covering all spanned rows
  - `moveGate(c, id, qubit, column)`: target moves to (qubit, column), and the control keeps its offset. Null if out of range or overlapping another gate
  - `updateParams(c, id, params)` (merge, finite only), `swapControlTarget(c, id)`, `removeGate(c, id)`
  - `setQubitCount(c, n)`: clamp to 1–8. Shrinking drops gates touching removed rows
  - `gateAt(c, qubit, column)`: the gate whose rows include `qubit` at `column`
  - `usedColumns(c)`
- [x] `serialize.ts`:
  - `toCircuitSpec(c)`: **web parity with `nodesToCircuitSpec`**. Sort by (column, qubit). `M` → `{type:'M', targets:[q], classical:[q]}`. Two-qubit → `{type, control, targets:[q], params?}`. Single → `{type, targets:[q], params?}`. `params` only for parametric gates. `qubits = classical_bits = qubitCount`
  - `fromCircuitSpec(spec, makeId)` → `{circuit, skipped}`: normalize `CNOT`→`CX` (case-insensitive types), pack columns like `components/circuit/layout.ts`, skip unknown or out-of-range gates (count them), and reject (`null`) specs with more than 8 qubits
- [x] `validate.ts`: `validateCircuit(spec): string[]`. Mirrors backend `QiskitAerAdapter.validate` (qubits ≥ 1, targets in range, finite angles) and adds client rules (≤ 8 qubits, control in range and ≠ target, known gate type). Empty means valid
- [x] `templates.ts`: `TEMPLATES` (id, title, description, spec): Superposition (H, M), Bell state (H q0, CX 0→1, M, M), GHZ 3-qubit, Interference (H, H, M). Labelled as examples
- [x] Tests: every op incl. edge cases (occupied cell shifts right, spanned rows block, move keeps control offset, shrink drops gates, serializer ordering and shape, CNOT import, round trip `fromCircuitSpec(toCircuitSpec(c))` keeps the spec equal, validation messages)

### Task 2: Editor store + interaction state machine
**Files:** `src/stores/circuit-editor-store.ts`, `src/features/circuit/editor/geometry.ts` + tests

- [x] `geometry.ts`: `GRID = {LABEL_W: 44, ROW_H: 56, COL_W: 56, GATE: 40, PAD_TOP: 12}`, `cellCenter(q,c)`, `cellFromPoint(x,y,qubitCount)` → `{qubit,column}|null` (null outside the grid or past `MAX_COLUMNS`), `canvasSize(qubitCount, columns)` (always at least 3 empty columns after the last used one)
- [x] `useCircuitEditorStore` (Zustand; persist `qubitCount, gates, name, shots` to `expo-sqlite/kv-store` as `qlearn.circuit-draft`). State: `qubitCount` (default 2), `gates`, `name` ('Untitled circuit'), `shots` (1024; one of 256/1024/4096), `selectedId`, `armed: GateType|null`, `pendingControl: {qubit,column}|null`, `past`/`future` (max 50, not persisted). IDs from `expo-crypto` `randomUUID`
- [x] Actions: `arm(type|null)` (arming clears selection and pending; tapping the armed type again disarms), `tapCell(qubit, column)`:
  - armed single-qubit → place (sticky arm, so several can be placed)
  - armed two-qubit, no pending → set `pendingControl`. Same qubit again → cancel. Different qubit → place with the pending column, then clear pending
  - not armed → select `gateAt`, or deselect on empty
- [x] Also `moveGate`, `updateParams`, `swapControlTarget`, `removeSelected`, `setQubitCount`, `clear`, `undo`, `redo`, `setShots`, `rename`, `loadSpec(spec, name)` → `{ok, skipped, error?}`, `loadTemplate(id)`, and selectors `spec()` (`toCircuitSpec`). Every mutating action pushes history. No-op or invalid ops don't
- [x] Tests: state-machine paths, sticky arm, two-tap two-qubit placement, cancel, undo/redo, persist partialize excludes transient state, loadSpec skip reporting

### Task 3: Build screen UI
**Files:** `src/components/circuit/editor/{CircuitCanvas.tsx,GatePalette.tsx,GateInspector.tsx,EditorToolbar.tsx,RunPanel.tsx,TemplatePicker.tsx}`, `src/app/(tabs)/build.tsx`, `src/components/lessons/blocks/OpenInBuilder.tsx` + tests

- [x] `CircuitCanvas`: SVG wires with labels `q0…`, gates drawn like `components/circuit/CircuitDiagram.tsx` (fill `GateColors`, control dot plus connector, SWAP as ×—×), a selection ring, a pending-control highlight, and faint column guides. One `Gesture.Tap()` → `cellFromPoint` → `tapCell` (`runOnJS`). Horizontal ScrollView for columns, inside a vertical ScrollView when rows exceed the height. **Screen-reader mode** (`AccessibilityInfo.isScreenReaderEnabled` + listener): render a grid of transparent `Pressable` cells with labels like "Qubit 1, step 3, H gate" or "…, empty". An `accessibilityLabel` on the canvas summarises the circuit
- [x] `GatePalette`: horizontal chips (symbol plus color) for the main set, plus a "More" toggle. The armed chip is highlighted. A status line explains the next step ("Tap a wire to place H", "Tap the control qubit for CNOT", "Now tap the target qubit")
- [x] `GateInspector` (when a gate is selected): name and description; for parametric gates, each param shown with `formatAngle`, preset chips, and −/+ in π/12 steps; "Swap control/target" for two-qubit gates; Delete
- [x] `EditorToolbar`: editable name, qubit stepper (− n +, 1–8), undo, redo, clear (Alert confirm)
- [x] `RunPanel`: shots segmented control (256/1024/4096). Run uses `useCircuitRun` with `spec()`, with `validateCircuit` gating the button (messages shown). Probabilities/state vector toggle using the existing `ProbabilityBars`/`StatevectorList`. Error banner (same messages as `SimulationBlock`). The existing `AskAboutCircuit` attaches the circuit as tutor context
- [x] `TemplatePicker`: shown when the circuit is empty (cards from `TEMPLATES`) and from a toolbar button
- [x] `build.tsx` composes these and replaces the placeholder. `OpenInBuilder` ("Open in Build") on `CircuitBlock` and `SimulationBlock` → `loadSpec` then `router.navigate('/build')`. It reports skipped gates via Alert
- [x] Component tests: palette arms, inspector edits params and deletes, run gating on validation, template loads, `OpenInBuilder` loads the spec

### Task 4: Drag to move
**Files:** `src/components/circuit/editor/DraggableGates.tsx` (or inside `CircuitCanvas`), geometry additions + tests

- [x] Long-press (≥ 250 ms) on a gate starts a `Gesture.Pan().activateAfterLongPress(250)`. Reanimated shared values translate a lifted copy of the gate (UI thread). On release, `cellFromPoint` → `moveGate` via `runOnJS`. An invalid drop springs back (`withSpring`). Taps still go through the Task 3 tap gesture, via `Gesture.Exclusive(drag, tap)` composed inside `CircuitCanvas`. The `composeGesture` prop was dropped because the drag needs canvas-local state
- [x] Pure helper `dropTarget(gate, dx, dy, qubitCount)` → `{qubit, column}|null` (tested): target cell after translating by (dx, dy), clamped so the control stays in range
- [x] Tests for `dropTarget`. A component smoke test that the canvas renders with the gesture

### Task 5: Docs and verification (controller)
- [x] Audit §18 status, README, AGENTS (editor model location)
- [x] lint, type-check, tests, iOS + Android export, screenshots
