import type { Edge, Node } from "@xyflow/react";

import type { ActivityNodeData } from "@/features/workflows/activity-node";
import type { ActivityJson, FlowchartConnection } from "@/lib/api/types";

/**
 * Folds React Flow nodes + edges back into the in-memory Flowchart root. Keeps
 * any non-position metadata that already lived on each activity; updates
 * positions from the live node coords; rebuilds `connections` from the edges.
 *
 * Activities the canvas knows about but aren't yet in the root JSON get added
 * (e.g. after a drop from the palette).
 */
export function syncFlowchart(
  root: ActivityJson,
  nodes: Node<ActivityNodeData>[],
  edges: Edge[],
): ActivityJson {
  const previous = new Map<string, ActivityJson>();
  for (const a of root.activities ?? []) previous.set(a.id, a);

  const activities: ActivityJson[] = nodes.map((n) => {
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

  const connections: FlowchartConnection[] = edges.map((e) => {
    const data = e.data as { vertices?: { x: number; y: number }[] } | undefined;
    const vertices = Array.isArray(data?.vertices) && data.vertices.length > 0
      ? data.vertices.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y) }))
      : undefined;
    return {
      source: { activity: e.source, port: e.sourceHandle ?? undefined },
      target: { activity: e.target, port: e.targetHandle ?? undefined },
      ...(vertices ? { vertices } : {}),
    };
  });

  // If the start activity got deleted, clear it; otherwise keep whatever the
  // user picked.
  const idsLeft = new Set(activities.map((a) => a.id));
  let start = root.start;
  const startId =
    typeof start === "string"
      ? start
      : start && typeof start === "object" && "activity" in start
        ? start.activity
        : undefined;
  if (startId && !idsLeft.has(startId)) start = null;

  return { ...root, activities, connections, start };
}
