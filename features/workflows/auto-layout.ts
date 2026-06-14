import * as dagre from "@dagrejs/dagre";

import type { ActivityJson } from "@/lib/api/types";

export type LayoutDirection = "LR" | "TB";

/** Default node size assumed by the layout when a node hasn't been measured yet. */
const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 80;

/**
 * Lay out the activities of a Flowchart root using `@dagrejs/dagre`. Mirrors
 * the Blazor react-designer's dagre layout (see
 * `Elsa.Studio.Workflows.Designer/ClientLib/src/react-designer/internal/dagre-layout.ts`).
 * Returns a new root with each activity's `metadata.designer.position` updated.
 *
 * Non-Flowchart roots are returned unchanged.
 */
export function layoutFlowchartRoot(
  root: ActivityJson,
  direction: LayoutDirection = "LR",
): ActivityJson {
  if (!Array.isArray(root.activities) || root.activities.length === 0) return root;

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: direction,
    nodesep: 60,
    ranksep: 90,
    edgesep: 24,
    marginx: 20,
    marginy: 20,
  });

  for (const a of root.activities) {
    const size = a.metadata?.designer?.size;
    const w = (size?.width as number | undefined) ?? DEFAULT_NODE_WIDTH;
    const h = (size?.height as number | undefined) ?? DEFAULT_NODE_HEIGHT;
    g.setNode(a.id, { width: w, height: h });
  }

  for (const c of root.connections ?? []) {
    if (!g.hasNode(c.source.activity) || !g.hasNode(c.target.activity)) continue;
    g.setEdge(c.source.activity, c.target.activity);
  }

  dagre.layout(g);

  const activities = root.activities.map((a) => {
    const node = g.node(a.id);
    if (!node) return a;
    // dagre gives centers; React Flow stores top-left, so subtract half the box.
    const w = node.width ?? DEFAULT_NODE_WIDTH;
    const h = node.height ?? DEFAULT_NODE_HEIGHT;
    const x = Math.round(node.x - w / 2);
    const y = Math.round(node.y - h / 2);
    const md = (a.metadata ?? {}) as Record<string, unknown>;
    const designer =
      (md.designer && typeof md.designer === "object"
        ? (md.designer as Record<string, unknown>)
        : {}) ?? {};
    return {
      ...a,
      metadata: {
        ...md,
        designer: { ...designer, position: { x, y } },
      },
    };
  });

  return { ...root, activities };
}
