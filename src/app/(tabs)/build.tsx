import { useState } from 'react';

import { CircuitCanvas } from '@/components/circuit/editor/CircuitCanvas';
import { EditorToolbar } from '@/components/circuit/editor/EditorToolbar';
import { GateInspector } from '@/components/circuit/editor/GateInspector';
import { GatePalette } from '@/components/circuit/editor/GatePalette';
import { RunPanel } from '@/components/circuit/editor/RunPanel';
import { TemplatePicker } from '@/components/circuit/editor/TemplatePicker';
import { ScreenTitle } from '@/components/ScreenTitle';
import { Screen } from '@/components/ui';
import { useCircuitEditorStore } from '@/stores/circuit-editor-store';

/**
 * The circuit editor. Each section subscribes to its own slice of the editor
 * store, so this screen only re-renders when the circuit becomes empty or
 * non-empty. The draft is restored from kv in the background; the editor is
 * usable before that finishes (never gate on hydration).
 */
export default function BuildScreen() {
  const empty = useCircuitEditorStore((s) => s.gates.length === 0);
  const [showTemplates, setShowTemplates] = useState(false);
  // An empty circuit always shows the examples; once it empties, close the
  // toolbar-opened copy so it doesn't reappear when gates are added again.
  const [wasEmpty, setWasEmpty] = useState(empty);
  if (wasEmpty !== empty) {
    setWasEmpty(empty);
    if (empty) setShowTemplates(false);
  }

  return (
    <Screen keyboard>
      <ScreenTitle title="Build" subtitle="Place gates, run your circuit, see what happens." />
      <EditorToolbar onShowTemplates={() => setShowTemplates((v) => !v)} templatesDisabled={empty} />
      <GatePalette />
      <CircuitCanvas />
      <GateInspector />
      {empty ? (
        <TemplatePicker />
      ) : showTemplates ? (
        <TemplatePicker onClose={() => setShowTemplates(false)} />
      ) : null}
      <RunPanel />
    </Screen>
  );
}
