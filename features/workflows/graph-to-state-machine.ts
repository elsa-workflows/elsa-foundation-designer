import type { Node } from "@xyflow/react";

import type { StateMachineNodeData } from "@/features/workflows/build-state-machine-graph";
import type { ActivityJson, StateMachineState } from "@/lib/api/types";

/**
 * Folds React Flow nodes back into a State Machine root, persisting per-state
 * positions under `metadata.designer.position`. Phase A is read-only-ish:
 * adding/removing states and editing transitions happens elsewhere — this
 * helper only mirrors position drags so the layout survives a save/reload.
 *
 * Edges are ignored on purpose (transitions are authored via the properties
 * panel, not by dragging edges in the canvas — at least until Phase B).
 *
 * The new position lives under the state's own `metadata.designer.position`
 * field (NOT the activity's). Unknown keys round-trip verbatim through the
 * .NET mapper, so this is forward-compatible with the existing JSON model.
 */
export function syncStateMachine(
  root: ActivityJson,
  nodes: Node<StateMachineNodeData>[],
): ActivityJson {
  const states = (root.states as StateMachineState[] | undefined) ?? [];
  const byName = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    byName.set(n.id, {
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
    });
  }
  const nextStates: StateMachineState[] = states.map((s) => {
    const p = byName.get(s.name);
    if (!p) return s;
    return {
      ...s,
      metadata: {
        ...(s.metadata ?? {}),
        designer: {
          ...(s.metadata?.designer ?? {}),
          position: p,
        },
      },
    };
  });
  return { ...root, states: nextStates };
}
