"use client";

import {
  getContainerAt,
  isFlowchartContainer,
  updateContainerAt,
  useEditorStore,
  type ContainerFrame,
} from "@/features/workflows/editor-store";
import type { ActivityJson, VariableDefinition } from "@/lib/api/types";

export type VariablesScope =
  | { kind: "root"; label: "Workflow" }
  | { kind: "container"; label: string; frames: ContainerFrame[] };

type Result = {
  scope: VariablesScope;
  variables: VariableDefinition[];
  setVariables: (next: VariableDefinition[]) => void;
};

/**
 * Resolves the "current" variables scope from the editor store's container
 * stack: when the user has drilled into a nested Flowchart, variables live on
 * THAT container; otherwise on the workflow root.
 *
 * Non-Flowchart containers (If.Then, ForEach.Body, etc.) don't carry their
 * own `variables[]` field — we walk back up the stack to the nearest
 * Flowchart ancestor, falling back to the root when none.
 */
export function useVariablesScope(): Result | null {
  const definition = useEditorStore((s) => s.definition);
  const containerStack = useEditorStore((s) => s.containerStack);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  const setRoot = useEditorStore((s) => s.setRoot);

  if (!definition) return null;

  // Find the deepest Flowchart container by walking the frame stack from
  // shallow to deep. Each prefix of frames is checked; the longest one whose
  // resolved container is a Flowchart wins. This means a stack like
  // [Flowchart, If.Then] resolves to the Flowchart prefix — variables tied to
  // the inner non-Flowchart frame fall through to the nearest ancestor that
  // owns a `variables[]` field.
  const flowchartFrames = findDeepestFlowchartFrames(
    definition.root,
    containerStack,
  );

  if (flowchartFrames.length === 0) {
    return {
      scope: { kind: "root", label: "Workflow" },
      variables: definition.variables ?? [],
      setVariables: (next) =>
        setDefinition((prev) => ({ ...prev, variables: next })),
    };
  }

  const target = getContainerAt(definition.root, flowchartFrames);
  const label = friendlyScopeLabel(target);

  return {
    scope: { kind: "container", label, frames: flowchartFrames },
    variables: (target.variables as VariableDefinition[] | undefined) ?? [],
    setVariables: (next) => {
      // Write through `updateContainerAt` so we can target an arbitrary
      // frame depth without disturbing the current container stack — the
      // user might be drilled deeper than the Flowchart we're editing.
      const nextRoot = updateContainerAt(
        definition.root,
        flowchartFrames,
        { ...target, variables: next } as ActivityJson,
      );
      setRoot(nextRoot);
    },
  };
}

function findDeepestFlowchartFrames(
  root: ActivityJson,
  frames: ContainerFrame[],
): ContainerFrame[] {
  if (frames.length === 0) return [];
  // Walk the stack and record the deepest prefix whose resolved container is
  // a Flowchart.
  let deepest = 0;
  for (let i = 1; i <= frames.length; i += 1) {
    const sub = frames.slice(0, i);
    const node = getContainerAt(root, sub);
    if (isFlowchartContainer(node)) deepest = i;
  }
  return frames.slice(0, deepest);
}

function friendlyScopeLabel(activity: ActivityJson): string {
  const meta = (activity.metadata as { displayText?: string } | undefined) ?? {};
  const displayText = meta.displayText?.trim();
  if (displayText) return `Flowchart "${displayText}"`;
  const name = typeof activity.name === "string" ? activity.name.trim() : "";
  if (name) return `Flowchart "${name}"`;
  return "Flowchart";
}
