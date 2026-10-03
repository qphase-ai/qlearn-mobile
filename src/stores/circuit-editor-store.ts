import { randomUUID } from 'expo-crypto';
import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { isGateType, isTwoQubitGate } from '@/features/circuit/editor/gates';
import * as model from '@/features/circuit/editor/model';
import { fromCircuitSpec, toCircuitSpec } from '@/features/circuit/editor/serialize';
import { TEMPLATES } from '@/features/circuit/editor/templates';
import {
  MAX_COLUMNS,
  type EditorCircuit,
  type EditorGate,
  type GateParams,
  type GateType,
} from '@/features/circuit/editor/types';
import type { CircuitSpec } from '@/types/contracts';

/**
 * Client state for the circuit editor (Build tab): the circuit being edited,
 * undo/redo, selection and the tap-to-place state machine. It is genuine
 * client state: there is no saved-circuits API (audit §13), so the draft is
 * autosaved to kv and only becomes server state when it is run. All circuit
 * rules live in the pure `model` ops; this store only sequences them.
 */

export const SHOT_OPTIONS = [256, 1024, 4096] as const;
export type Shots = (typeof SHOT_OPTIONS)[number];

export const DEFAULT_QUBITS = 2;
export const DEFAULT_NAME = 'Untitled circuit';
export const DEFAULT_SHOTS: Shots = 1024;
export const HISTORY_LIMIT = 50;
const NAME_MAX = 80;

export type LoadResult = { ok: true; skipped: number } | { ok: false; error: string };

const LOAD_ERRORS = {
  'too-many-qubits': 'This circuit uses more than 8 qubits, the most the builder supports.',
  invalid: "This circuit can't be opened in the builder.",
} as const;

/**
 * One undo step: the circuit plus its name, so undoing a load also restores
 * the name it replaced. `rename` itself is not an undo step; an undo after a
 * rename restores the name the snapshot was taken with.
 */
export interface EditorSnapshot extends EditorCircuit {
  name: string;
}

interface CircuitEditorState {
  qubitCount: number;
  gates: EditorGate[];
  name: string;
  shots: Shots;
  selectedId: string | null;
  /** Palette gate being placed; stays armed after a placement so several can be placed. */
  armed: GateType | null;
  /** First tap of a two-qubit placement: the control qubit and the column to place in. */
  pendingControl: { qubit: number; column: number } | null;
  /** Snapshots for undo/redo, oldest first. Not persisted. */
  past: EditorSnapshot[];
  future: EditorSnapshot[];

  /** Arm a palette gate; arming the armed gate again (or null) disarms. */
  arm: (type: GateType | null) => void;
  /** A tap on a canvas cell, interpreted by the armed/pending state. */
  tapCell: (qubit: number, column: number) => void;
  /** Move a gate's target (the control keeps its offset). False when the drop is rejected. */
  moveGate: (id: string, qubit: number, column: number) => boolean;
  updateParams: (id: string, params: GateParams) => void;
  swapControlTarget: (id: string) => void;
  removeSelected: () => void;
  setQubitCount: (count: number) => void;
  /** Remove every gate, keeping the qubit count. */
  clear: () => void;
  undo: () => void;
  redo: () => void;
  setShots: (shots: Shots) => void;
  rename: (name: string) => void;
  /** Replace the circuit with a spec (lesson circuit, template). Undo restores the previous one. */
  loadSpec: (spec: CircuitSpec, name: string) => LoadResult;
  loadTemplate: (id: string) => LoadResult;
  /** The current circuit in the canonical format the backend runs. */
  spec: () => CircuitSpec;
}

type Draft = Pick<CircuitEditorState, 'qubitCount' | 'gates' | 'name' | 'shots'>;

const circuitOf = (s: Pick<CircuitEditorState, 'qubitCount' | 'gates'>): EditorCircuit => ({
  qubitCount: s.qubitCount,
  gates: s.gates,
});

const snapshotOf = (s: Pick<CircuitEditorState, 'qubitCount' | 'gates' | 'name'>): EditorSnapshot => ({
  qubitCount: s.qubitCount,
  gates: s.gates,
  name: s.name,
});

/** Interaction and history state that never outlives a session. */
const TRANSIENT = {
  selectedId: null,
  armed: null,
  pendingControl: null,
  past: [],
  future: [],
} satisfies Partial<CircuitEditorState>;

const DEFAULT_DRAFT = {
  qubitCount: DEFAULT_QUBITS,
  gates: [],
  name: DEFAULT_NAME,
  shots: DEFAULT_SHOTS,
} satisfies Partial<CircuitEditorState>;

/** Drop a selection that no longer points at a gate (after undo, remove, shrink…). */
const keepSelection = (selectedId: string | null, gates: EditorGate[]) =>
  selectedId !== null && gates.some((g) => g.id === selectedId) ? selectedId : null;

function cleanName(name: unknown): string {
  if (typeof name !== 'string') return DEFAULT_NAME;
  const oneLine = name.replace(/\s+/g, ' ').trim();
  return oneLine ? oneLine.slice(0, NAME_MAX) : DEFAULT_NAME;
}

const isShots = (value: unknown): value is Shots => SHOT_OPTIONS.includes(value as Shots);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Rebuild a persisted draft through the model ops, so a corrupt or outdated
 * draft (bad qubit count, unknown gate types, overlapping or out-of-range
 * gates) loads as the valid part of itself instead of crashing the editor.
 * A gate that would not land exactly where it was saved is dropped.
 */
export function sanitizeDraft(persisted: unknown): Draft {
  const p = isRecord(persisted) ? persisted : {};
  const count = typeof p.qubitCount === 'number' ? p.qubitCount : DEFAULT_QUBITS;
  let circuit = model.setQubitCount({ qubitCount: DEFAULT_QUBITS, gates: [] }, count);
  for (const raw of Array.isArray(p.gates) ? p.gates : []) {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !isGateType(raw.type)) continue;
    const { id, type, qubit, column, control } = raw;
    if (typeof qubit !== 'number' || typeof column !== 'number') continue;
    const placed = isTwoQubitGate(type)
      ? typeof control === 'number'
        ? model.placeTwoQubitGate(circuit, type, control, qubit, column, id)
        : null
      : model.placeGate(circuit, type, qubit, column, id);
    if (!placed || placed.gates[placed.gates.length - 1].column !== column) continue;
    circuit = isRecord(raw.params) ? (model.updateParams(placed, id, raw.params as GateParams) ?? placed) : placed;
  }
  return {
    qubitCount: circuit.qubitCount,
    gates: circuit.gates,
    name: cleanName(p.name),
    shots: isShots(p.shots) ? p.shots : DEFAULT_SHOTS,
  };
}

export const useCircuitEditorStore = create<CircuitEditorState>()(
  persist(
    (set, get) => {
      /**
       * Apply a model op's result. Null (invalid) and the same circuit object
       * (nothing changed) are ignored, so they never create an undo step.
       */
      const commit = (next: EditorCircuit | null, current: EditorCircuit): boolean => {
        if (!next || next === current) return false;
        set((s) => ({
          qubitCount: next.qubitCount,
          gates: next.gates,
          past: [...s.past, { ...current, name: s.name }].slice(-HISTORY_LIMIT),
          future: [],
          selectedId: keepSelection(s.selectedId, next.gates),
        }));
        return true;
      };

      const apply = (op: (c: EditorCircuit) => EditorCircuit | null): boolean => {
        const current = circuitOf(get());
        return commit(op(current), current);
      };

      return {
        ...DEFAULT_DRAFT,
        ...TRANSIENT,

        arm: (type) =>
          set((s) => ({
            armed: type === null || type === s.armed ? null : type,
            selectedId: null,
            pendingControl: null,
          })),

        tapCell: (qubit, column) => {
          const { armed, pendingControl, qubitCount, gates } = get();
          if (!armed) {
            const gate = model.gateAt({ qubitCount, gates }, qubit, column);
            set({ selectedId: gate?.id ?? null });
            return;
          }
          if (!isTwoQubitGate(armed)) {
            apply((c) => model.placeGate(c, armed, qubit, column, randomUUID()));
            return;
          }
          if (!pendingControl) {
            const inGrid =
              Number.isInteger(qubit) &&
              qubit >= 0 &&
              qubit < qubitCount &&
              Number.isInteger(column) &&
              column >= 0 &&
              column < MAX_COLUMNS;
            if (inGrid) set({ pendingControl: { qubit, column } });
            return;
          }
          // The second tap only picks the target qubit: the gate is placed from
          // the first tap's column, wherever the second one landed. Like every
          // placement (and the web), if that column is taken on any spanned row
          // the gate shifts right to the next column free on all of them.
          set({ pendingControl: null });
          if (qubit === pendingControl.qubit) return;
          apply((c) =>
            model.placeTwoQubitGate(c, armed, pendingControl.qubit, qubit, pendingControl.column, randomUUID()),
          );
        },

        moveGate: (id, qubit, column) => apply((c) => model.moveGate(c, id, qubit, column)),
        updateParams: (id, params) => {
          apply((c) => model.updateParams(c, id, params));
        },
        swapControlTarget: (id) => {
          apply((c) => model.swapControlTarget(c, id));
        },
        removeSelected: () => {
          const { selectedId } = get();
          if (selectedId) apply((c) => model.removeGate(c, selectedId));
        },
        setQubitCount: (count) => {
          set({ pendingControl: null });
          apply((c) => model.setQubitCount(c, count));
        },
        clear: () => {
          apply((c) => (c.gates.length === 0 ? c : { ...c, gates: [] }));
        },

        undo: () => {
          const s = get();
          const previous = s.past[s.past.length - 1];
          if (!previous) return;
          set({
            qubitCount: previous.qubitCount,
            gates: previous.gates,
            name: previous.name,
            past: s.past.slice(0, -1),
            future: [snapshotOf(s), ...s.future],
            selectedId: keepSelection(s.selectedId, previous.gates),
            pendingControl: null,
          });
        },
        redo: () => {
          const s = get();
          const [next, ...rest] = s.future;
          if (!next) return;
          set({
            qubitCount: next.qubitCount,
            gates: next.gates,
            name: next.name,
            past: [...s.past, snapshotOf(s)].slice(-HISTORY_LIMIT),
            future: rest,
            selectedId: keepSelection(s.selectedId, next.gates),
            pendingControl: null,
          });
        },

        setShots: (shots) => {
          if (isShots(shots)) set({ shots });
        },
        rename: (name) => set({ name: cleanName(name) }),

        loadSpec: (spec, name) => {
          const result = fromCircuitSpec(spec, randomUUID);
          if (!result.ok) return { ok: false, error: LOAD_ERRORS[result.reason] };
          const current = get();
          const nextName = cleanName(name);
          // Reloading what is already open (same spec, same name) is not an edit:
          // keep the gates (and their ids) and add no undo step.
          const unchanged =
            nextName === current.name &&
            JSON.stringify(toCircuitSpec(result.circuit)) === JSON.stringify(toCircuitSpec(circuitOf(current)));
          if (!unchanged) {
            commit(result.circuit, circuitOf(current));
            set({ name: nextName });
          }
          set({ selectedId: null, armed: null, pendingControl: null });
          return { ok: true, skipped: result.skipped };
        },
        loadTemplate: (id) => {
          const template = TEMPLATES.find((t) => t.id === id);
          if (!template) return { ok: false, error: LOAD_ERRORS.invalid };
          return get().loadSpec(template.spec, template.title);
        },

        spec: () => toCircuitSpec(circuitOf(get())),
      };
    },
    {
      name: 'qlearn.circuit-draft',
      // Bump with a `migrate` when the draft's shape changes; zustand drops a
      // stored draft whose version it cannot migrate.
      version: 1,
      storage: createJSONStorage(() => Storage),
      // Only the draft survives a restart; history, selection and the
      // placement state machine are per-session.
      partialize: (s): Draft => ({ qubitCount: s.qubitCount, gates: s.gates, name: s.name, shots: s.shots }),
      /**
       * kv reads are async, so the user can edit (e.g. "Open in Build" on a cold
       * start) before the saved draft arrives. Their edit wins: once there is an
       * undo step, the stored draft is ignored rather than clobbering it.
       * Nothing stored yet (first launch) keeps the defaults untouched.
       */
      merge: (persisted, current) =>
        !isRecord(persisted) || current.past.length > 0
          ? current
          : { ...current, ...sanitizeDraft(persisted), ...TRANSIENT },
      /**
       * An unreadable draft (e.g. not JSON) rejects hydration, and zustand then
       * never marks the store hydrated, so UI must not gate on `hasHydrated()`.
       * Reset to an empty draft instead (unless the user already edited); the
       * write that follows also replaces the corrupt value in kv.
       */
      onRehydrateStorage: () => (_state, error) => {
        if (!error) return;
        if (useCircuitEditorStore.getState().past.length > 0) return;
        useCircuitEditorStore.setState({ ...DEFAULT_DRAFT, ...TRANSIENT });
      },
    }
  )
);
