import type { Edge, Node } from "@xyflow/react";

import type { ActivityNodeData } from "@/features/workflows/activity-node";
import type { ActivityStats } from "@/features/workflows/activity-stats";
import { buildStateMachineGraph } from "@/features/workflows/build-state-machine-graph";
import type { ActivityJson, FlowchartConnection } from "@/lib/api/types";

/** Deterministic edge id for a connection. Survives commit→rehydrate cycles. */
function edgeIdFor(c: FlowchartConnection, fallbackIndex: number): string {
  const sp = c.source.port ?? "out";
  const tp = c.target.port ?? "in";
  // Index suffix keeps duplicates (rare) addressable.
  return `e-${fallbackIndex}-${c.source.activity}:${sp}->${c.target.activity}:${tp}`;
}

/** Strips the `Elsa.Workflows.Activities.Foo.Bar` namespace to just `Bar`. */
function shortTypeName(type: string): string {
  const segs = type.split(".");
  return segs[segs.length - 1] ?? type;
}

function displayText(activity: ActivityJson): string {
  const md = activity.metadata ?? {};
  return (
    (typeof md.displayText === "string" && md.displayText.trim()) ||
    (typeof activity.id === "string" && activity.id) ||
    shortTypeName(activity.type)
  );
}

/** Mirrors Blazor `Activity.GetCanStartWorkflow()`. */
function canStartWorkflow(activity: ActivityJson): boolean {
  const v = (activity as Record<string, unknown>).canStartWorkflow;
  return v === true;
}

function showDescription(activity: ActivityJson): boolean {
  const v = (activity.metadata as Record<string, unknown> | undefined)?.showDescription;
  return v === true;
}

function descriptionText(activity: ActivityJson): string | undefined {
  const v = activity.metadata?.description;
  return typeof v === "string" && v.trim().length > 0 ? v : undefined;
}

function designerPosition(activity: ActivityJson, fallback: { x: number; y: number }) {
  const p = activity.metadata?.designer?.position;
  if (p && typeof p.x === "number" && typeof p.y === "number") return { x: p.x, y: p.y };
  return fallback;
}

/** Resolves the start-activity id of a Flowchart from its `start` field. */
function flowchartStartId(root: ActivityJson): string | undefined {
  const s = root.start;
  if (!s) return undefined;
  if (typeof s === "string") return s;
  if (typeof s === "object" && s && "activity" in s && typeof s.activity === "string") {
    return s.activity;
  }
  return undefined;
}

export type BuiltGraph = {
  nodes: Node<ActivityNodeData>[];
  edges: Edge[];
  /** True when we found a recognizable Flowchart structure with activities. */
  isFlowchart: boolean;
  /**
   * True when the root is a Sequence-typed activity. Sequences render as a
   * vertical column with implicit edges between consecutive children — there
   * are no `connections[]` in the data model; ordering is derived from the
   * `activities[]` array index. The canvas write-back path needs to know so
   * it routes through `graph-to-sequence` instead of `graph-to-flowchart`.
   */
  isSequence?: boolean;
  /**
   * True when the root is an `Elsa.StateMachine` activity. State machines
   * render with a dedicated state node type and transition edge type — the
   * canvas dispatches by this flag to register the right NODE_TYPES.
   */
  isStateMachine?: boolean;
};

/** Detect Sequence-typed roots that should render as a vertical column. */
export function isSequenceRoot(root: ActivityJson): boolean {
  if (typeof root.type !== "string") return false;
  if (!(root.type.endsWith(".Sequence") || root.type === "Sequence")) return false;
  return Array.isArray(root.activities);
}

/** Detect Elsa.StateMachine-typed roots. */
export function isStateMachineRoot(root: ActivityJson): boolean {
  if (typeof root.type !== "string") return false;
  return root.type === "Elsa.StateMachine" || root.type.endsWith(".StateMachine");
}

export type SequenceOrientation = "vertical" | "horizontal";

/**
 * Read the persisted Sequence-canvas orientation from
 * `customProperties.sequenceOrientation`. Defaults to "horizontal" so newly
 * added activities flow left-to-right (matching the Flowchart canvas, whose
 * happy-path layout already advances along the x-axis). A workflow that
 * explicitly opted into a vertical column keeps it.
 * Stored on the root so it round-trips through the .NET tier verbatim
 * (custom properties are preserved as opaque keys).
 */
export function getSequenceOrientation(root: ActivityJson): SequenceOrientation {
  const cp = (root.customProperties ?? {}) as Record<string, unknown>;
  return cp.sequenceOrientation === "vertical" ? "vertical" : "horizontal";
}

export type BuildGraphOptions = {
  /** Per-activity execution stats keyed by activityId (instance viewer). */
  statsByActivityId?: Record<string, ActivityStats>;
};

/**
 * Converts an Elsa workflow definition's root activity into React Flow nodes +
 * edges. Supports Flowchart-typed root activities (the common case). For
 * non-flowchart roots returns a single node so the viewer still has something
 * to show.
 */
export function buildGraphFromRoot(
  root: ActivityJson,
  options: BuildGraphOptions = {},
): BuiltGraph {
  const isFlowchart =
    typeof root.type === "string" &&
    (root.type.endsWith(".Flowchart") || root.type === "Flowchart") &&
    Array.isArray(root.activities);
  const isSequence = isSequenceRoot(root);
  const isStateMachine = isStateMachineRoot(root);

  const statsByActivityId = options.statsByActivityId ?? {};

  if (isStateMachine) {
    // The state-machine builder returns nodes/edges whose `data` shape is
    // narrower than `ActivityNodeData`. The canvas only ever reads the data
    // through the matching node/edge components (StateNode reads its data
    // as `StateMachineNodeData`), so we widen via an unknown-cast here.
    const sm = buildStateMachineGraph(root);
    return {
      isFlowchart: false,
      isStateMachine: true,
      nodes: sm.nodes as unknown as BuiltGraph["nodes"],
      edges: sm.edges as unknown as BuiltGraph["edges"],
    };
  }
  if (isSequence) return buildSequenceGraph(root, statsByActivityId);

  if (!isFlowchart) {
    return {
      isFlowchart: false,
      nodes: [
        {
          id: root.id,
          type: "activity",
          position: { x: 0, y: 0 },
          data: {
            label: displayText(root),
            typeName: root.type,
            typeShort: shortTypeName(root.type),
            canStartWorkflow: canStartWorkflow(root),
            description: descriptionText(root),
            showDescription: showDescription(root),
            isFlowchart: true,
            stats: statsByActivityId[root.id],
          },
        },
      ],
      edges: [],
    };
  }

  const activities = root.activities ?? [];
  const connections: FlowchartConnection[] = root.connections ?? [];
  const startId = flowchartStartId(root);

  // Compute positions: prefer designer positions; if entirely missing, lay out
  // in a simple grid so the graph is at least readable.
  const anyPositioned = activities.some((a) => a.metadata?.designer?.position);
  const COLS = 4;
  const COL_W = 260;
  const ROW_H = 120;

  const nodes: Node<ActivityNodeData>[] = activities.map((a, i) => {
    const fallback = anyPositioned
      ? { x: i * 40, y: i * 40 } // shouldn't be hit much; just don't overlap
      : { x: (i % COLS) * COL_W, y: Math.floor(i / COLS) * ROW_H };
    return {
      id: a.id,
      type: "activity",
      position: designerPosition(a, fallback),
      data: {
        label: displayText(a),
        typeName: a.type,
        typeShort: shortTypeName(a.type),
        isStart: a.id === startId,
        canStartWorkflow: canStartWorkflow(a),
        description: descriptionText(a),
        showDescription: showDescription(a),
        stats: statsByActivityId[a.id],
      },
    };
  });

  const edges: Edge[] = connections.map((c, i) => ({
    // Edge id is stable per source/target/port quadruple so an unchanged
    // connection keeps the same id across commit → rehydrate cycles.
    id: edgeIdFor(c, i),
    source: c.source.activity,
    target: c.target.activity,
    sourceHandle: c.source.port ?? undefined,
    targetHandle: c.target.port ?? undefined,
    label: c.source.port && c.source.port !== "Done" ? c.source.port : undefined,
    animated: false,
    style: { stroke: "var(--muted-foreground)" },
    labelStyle: { fontSize: 11, fill: "var(--muted-foreground)" },
    labelBgStyle: { fill: "var(--background)" },
    // Carry the persisted polyline waypoints so `ElsaFlowEdge` can render a
    // bent path. The list is empty / undefined for auto-routed connections;
    // the round-trip lives in `graph-to-flowchart.syncFlowchart`.
    data: Array.isArray(c.vertices) && c.vertices.length > 0
      ? { vertices: c.vertices }
      : undefined,
  }));

  return { nodes, edges, isFlowchart: true };
}

const SEQ_COL_X = 0;
const SEQ_ROW_H = 140;
const SEQ_COL_W = 280;

/** Stable id for the synthetic edge connecting two consecutive Sequence children. */
function sequenceEdgeId(fromId: string): string {
  return `e-seq-${fromId}`;
}

/**
 * Builds a vertical column from `root.activities[]`. There are no
 * `connections[]` in a Sequence; ordering is implicit. We synthesise an edge
 * between each consecutive pair so the canvas shows the flow visually and so
 * the existing edge-splice UX (the `+` hover button) just works.
 */
function buildSequenceGraph(
  root: ActivityJson,
  statsByActivityId: Record<string, ActivityStats>,
): BuiltGraph {
  const activities = root.activities ?? [];
  const anyPositioned = activities.some((a) => a.metadata?.designer?.position);
  const orientation = getSequenceOrientation(root);
  // For "horizontal" we lay activities out in a row (rising x); for
  // "vertical" we use a column (rising y).
  const fallbackPos = (i: number) =>
    orientation === "horizontal"
      ? { x: i * SEQ_COL_W, y: 0 }
      : { x: SEQ_COL_X, y: i * SEQ_ROW_H };

  const nodes: Node<ActivityNodeData>[] = activities.map((a, i) => {
    const fallback = anyPositioned
      ? fallbackPos(i) // unlikely to overlap; user can drag
      : fallbackPos(i);
    return {
      id: a.id,
      type: "activity",
      position: designerPosition(a, fallback),
      data: {
        label: displayText(a),
        typeName: a.type,
        typeShort: shortTypeName(a.type),
        canStartWorkflow: canStartWorkflow(a),
        description: descriptionText(a),
        showDescription: showDescription(a),
        stats: statsByActivityId[a.id],
      },
    };
  });

  const edges: Edge[] = [];
  for (let i = 0; i < activities.length - 1; i += 1) {
    const a = activities[i];
    const b = activities[i + 1];
    edges.push({
      id: sequenceEdgeId(a.id),
      source: a.id,
      target: b.id,
      animated: false,
      style: { stroke: "var(--muted-foreground)" },
      // Sequences derive ordering from `activities[]`, so the rendered edge
      // can't be removed in isolation — `syncSequence` ignores edges entirely.
      // Mark as non-deletable so React Flow's Delete-key path and the edge's
      // hover × control both skip these.
      deletable: false,
      data: { implicit: true },
    });
  }

  return { nodes, edges, isFlowchart: false, isSequence: true };
}
