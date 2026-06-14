import type { Node } from "@xyflow/react";

import type { ActivityNodeData } from "@/features/workflows/activity-node";
import { getSequenceOrientation } from "@/features/workflows/build-graph";
import { setEmbeddedChildren } from "@/features/workflows/embedded-ports";
import type { ActivityJson } from "@/lib/api/types";

/**
 * Folds React Flow nodes back into a Sequence root. Sequence ordering is
 * implicit — `activities[i+1]` runs after `activities[i]` — so we derive the
 * new order from each node's Y position (ascending). Designer x/y are
 * persisted in `metadata.designer.position` so a user that's reordered
 * everything to specific coordinates sees the exact same layout next time.
 *
 * Edges are not used here: Sequence has no `connections[]` and any synthetic
 * edges drawn by `build-graph.ts:buildSequenceGraph` are presentational only.
 * Writes go through `embedded-ports`' arrayProvider so the same code that
 * mutates nested Sequences (`Parallel.branches`, etc.) is exercised.
 */
export function syncSequence(
  root: ActivityJson,
  nodes: Node<ActivityNodeData>[],
): ActivityJson {
  const previous = new Map<string, ActivityJson>();
  for (const a of root.activities ?? []) previous.set(a.id, a);

  // Sort by primary axis (Y for vertical, X for horizontal). Tie-break with a
  // generous "intentional move" threshold so a tiny accidental drag (1–2 px
  // while clicking) doesn't reshuffle the execution order.
  const orientation = getSequenceOrientation(root);
  const REORDER_THRESHOLD = 70;
  const previousIndex = new Map<string, number>();
  (root.activities ?? []).forEach((a, i) => previousIndex.set(a.id, i));
  const ordered = [...nodes].sort((a, b) => {
    const primary =
      orientation === "horizontal"
        ? a.position.x - b.position.x
        : a.position.y - b.position.y;
    if (Math.abs(primary) > REORDER_THRESHOLD) return primary;
    const secondary =
      orientation === "horizontal"
        ? a.position.y - b.position.y
        : a.position.x - b.position.x;
    if (Math.abs(secondary) > 1) return secondary;
    return (previousIndex.get(a.id) ?? 0) - (previousIndex.get(b.id) ?? 0);
  });

  const activities: ActivityJson[] = ordered.map((n) => {
    const prior = previous.get(n.id);
    const base: ActivityJson = prior ?? {
      id: n.id,
      type: n.data.typeName,
      metadata: {},
    };
    return {
      ...base,
      metadata: {
        ...(base.metadata ?? {}),
        displayText: n.data.label ?? base.metadata?.displayText,
        designer: {
          ...(base.metadata?.designer ?? {}),
          position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
        },
      },
    };
  });

  // Write through arrayProvider (Sequence.activities) so any provider quirks
  // (e.g. case-of-port-name) are honored.
  return setEmbeddedChildren(root, { name: "activities" }, activities);
}
