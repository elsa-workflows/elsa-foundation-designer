import type { Edge, Node } from "@xyflow/react";

import type { ActivityNodeData } from "@/features/workflows/activity-node";
import { buildGraphFromRoot } from "@/features/workflows/build-graph";
import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

/**
 * "Happy path" left-to-right layout, ported from the Blazor designer's
 * `arrangeHappyPath.ts`. Guarantees the main success chain renders as a
 * straight horizontal line, with side branches stacked into rows below.
 *
 * Algorithm summary:
 *  1. Column = topological longest-path depth from start nodes.
 *  2. Row = walked from each start along the *default* outgoing edge (the
 *     activity's first declared output port — typically "Done"); any
 *     non-default branch claims a fresh row beneath.
 *  3. Cell widths/heights = max node dimensions per column/row, with fixed
 *     rank/row separation so every gap is equal regardless of node sizes.
 *  4. Each node is centred within its (column, row) cell, which is what
 *     keeps same-row nodes perfectly aligned for smooth-step edges to draw
 *     as straight lines.
 */

export type HappyPathLayoutOptions = {
  /** Horizontal gap (px) between adjacent columns. */
  rankSep?: number;
  /** Vertical gap (px) between adjacent rows. */
  rowSep?: number;
  /** Fallback dimensions when a node hasn't been measured yet. */
  defaultWidth?: number;
  defaultHeight?: number;
  /**
   * For a given activity, return its declared output port names in order.
   * The first name is treated as the happy-path continuation. When omitted
   * (or when a node has no descriptor), edges are sorted by insertion order.
   */
  portsByType?: (typeName: string) => string[] | undefined;
};

const DEFAULTS: Required<Omit<HappyPathLayoutOptions, "portsByType">> = {
  rankSep: 120,
  rowSep: 90,
  defaultWidth: 240,
  defaultHeight: 80,
};

function widthOf(n: Node, fallback: number): number {
  const w = n.measured?.width ?? (n.width as number | undefined);
  return typeof w === "number" ? w : fallback;
}

function heightOf(n: Node, fallback: number): number {
  const h = n.measured?.height ?? (n.height as number | undefined);
  return typeof h === "number" ? h : fallback;
}

export function arrangeHappyPath<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  opts: HappyPathLayoutOptions = {},
): Node<T>[] {
  if (nodes.length === 0) return nodes;
  const { rankSep, rowSep, defaultWidth, defaultHeight } = { ...DEFAULTS, ...opts };
  const { portsByType } = opts;

  // ---- Adjacency lists -------------------------------------------------
  const outs = new Map<string, Edge[]>();
  const ins = new Map<string, Edge[]>();
  for (const n of nodes) {
    outs.set(n.id, []);
    ins.set(n.id, []);
  }
  for (const e of edges) {
    outs.get(e.source)?.push(e);
    ins.get(e.target)?.push(e);
  }

  // Port-index lookup: portIndex.get(nodeId).get(handleId) → 0-based index.
  const portIndexByNode = new Map<string, Map<string, number>>();
  for (const n of nodes) {
    const map = new Map<string, number>();
    const typeName = (n.data as unknown as ActivityNodeData | undefined)?.typeName;
    const names = typeName && portsByType ? portsByType(typeName) : undefined;
    if (names) names.forEach((id, i) => map.set(id, i));
    portIndexByNode.set(n.id, map);
  }

  // Sort each source's outgoing edges so the first declared port wins.
  for (const [sourceId, arr] of outs) {
    const idxByHandle = portIndexByNode.get(sourceId);
    arr.sort((a, b) => {
      const ai = idxByHandle?.get(a.sourceHandle ?? "") ?? Number.MAX_SAFE_INTEGER;
      const bi = idxByHandle?.get(b.sourceHandle ?? "") ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }

  // ---- Columns: topological longest-path (Kahn's) ---------------------
  const depth = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const n of nodes) inDeg.set(n.id, ins.get(n.id)!.length);
  const ready: string[] = [];
  for (const n of nodes) {
    if (inDeg.get(n.id) === 0) {
      depth.set(n.id, 0);
      ready.push(n.id);
    }
  }
  while (ready.length) {
    const id = ready.shift()!;
    const d = depth.get(id) ?? 0;
    for (const e of outs.get(id) ?? []) {
      const t = e.target;
      const td = depth.get(t);
      if (td === undefined || d + 1 > td) depth.set(t, d + 1);
      const nd = (inDeg.get(t) ?? 0) - 1;
      inDeg.set(t, nd);
      if (nd === 0) ready.push(t);
    }
  }
  // Anything not depth-resolved (cycles, fully orphaned) → column 0.
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, 0);

  // ---- Rows: walk the happy chain, branches below ---------------------
  const row = new Map<string, number>();
  let nextRow = 0;

  const visit = (id: string, currentRow: number): void => {
    if (row.has(id)) return;
    row.set(id, currentRow);
    const myOuts = outs.get(id) ?? [];
    for (let i = 0; i < myOuts.length; i++) {
      const target = myOuts[i].target;
      if (row.has(target)) continue;
      if (i === 0) {
        // Default branch: stay on the same row.
        visit(target, currentRow);
      } else {
        // Side branch: new row below.
        nextRow++;
        visit(target, nextRow);
      }
    }
  };

  // Triggers (canStartWorkflow=true) get the first row when possible — that's
  // the "real" entry point users expect at the top.
  const starts = nodes
    .filter((n) => (ins.get(n.id)?.length ?? 0) === 0)
    .sort((a, b) => {
      const ad = a.data as unknown as ActivityNodeData | undefined;
      const bd = b.data as unknown as ActivityNodeData | undefined;
      const aStart = ad?.canStartWorkflow || ad?.isStart ? 0 : 1;
      const bStart = bd?.canStartWorkflow || bd?.isStart ? 0 : 1;
      return aStart - bStart;
    })
    .map((n) => n.id);
  if (starts.length === 0) starts.push(nodes[0].id);

  for (const startId of starts) {
    if (!row.has(startId)) {
      visit(startId, nextRow);
      nextRow++;
    }
  }
  // Reach any remaining disconnected nodes.
  for (const n of nodes) {
    if (!row.has(n.id)) {
      visit(n.id, nextRow);
      nextRow++;
    }
  }

  // ---- Column widths + X anchors --------------------------------------
  const numCols = Math.max(...depth.values()) + 1;
  const colWidth = new Array<number>(numCols).fill(0);
  for (const n of nodes) {
    const c = depth.get(n.id) ?? 0;
    const w = widthOf(n, defaultWidth);
    if (w > colWidth[c]) colWidth[c] = w;
  }
  const colX = new Array<number>(numCols);
  let cursorX = 0;
  for (let c = 0; c < numCols; c++) {
    if (c > 0) cursorX += rankSep;
    colX[c] = cursorX;
    cursorX += colWidth[c];
  }

  // ---- Row heights + Y anchors ---------------------------------------
  const numRows = Math.max(...row.values()) + 1;
  const rowHeight = new Array<number>(numRows).fill(0);
  for (const n of nodes) {
    const r = row.get(n.id) ?? 0;
    const h = heightOf(n, defaultHeight);
    if (h > rowHeight[r]) rowHeight[r] = h;
  }
  const rowY = new Array<number>(numRows);
  let cursorY = 0;
  for (let r = 0; r < numRows; r++) {
    if (r > 0) cursorY += rowSep;
    rowY[r] = cursorY;
    cursorY += rowHeight[r];
  }

  // ---- Apply: centre each node within its (col, row) cell ------------
  return nodes.map((n) => {
    const c = depth.get(n.id) ?? 0;
    const r = row.get(n.id) ?? 0;
    const w = widthOf(n, defaultWidth);
    const h = heightOf(n, defaultHeight);
    const x = Math.round(colX[c] + (colWidth[c] - w) / 2);
    const y = Math.round(rowY[r] + (rowHeight[r] - h) / 2);
    return { ...n, position: { x, y } };
  });
}

/**
 * Apply the happy-path layout to a Flowchart root and write the new positions
 * into each activity's `metadata.designer.position`. Builds the React Flow
 * node/edge graph internally — used by the toolbar's "Auto-layout" button
 * where there's no pre-existing local node state to feed in.
 *
 * Non-Flowchart roots are returned unchanged.
 */
export function layoutRootHappyPath(
  root: ActivityJson,
  descriptorIndex?: Map<string, ActivityDescriptor>,
): ActivityJson {
  if (!Array.isArray(root.activities)) return root;

  const built = buildGraphFromRoot(root);
  const portsByType = descriptorIndex
    ? (typeName: string): string[] | undefined => {
        const d = descriptorIndex.get(typeName);
        if (!d) return undefined;
        return d.ports
          .filter((p) => p.type === "Flow")
          .map((p) => p.name);
      }
    : undefined;

  const laid = arrangeHappyPath(built.nodes, built.edges, { portsByType });
  const posById = new Map<string, { x: number; y: number }>();
  for (const n of laid) posById.set(n.id, { x: n.position.x, y: n.position.y });

  const activities = root.activities.map((a) => {
    const p = posById.get(a.id);
    if (!p) return a;
    return {
      ...a,
      metadata: {
        ...(a.metadata ?? {}),
        designer: {
          ...((a.metadata?.designer as Record<string, unknown> | undefined) ?? {}),
          position: p,
        },
      },
    };
  });
  return { ...root, activities };
}
