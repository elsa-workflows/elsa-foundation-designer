import type { Edge, Node } from "@xyflow/react";

import { layoutStateMachineGrid } from "@/features/workflows/state-machine-layout";
import type {
  ActivityJson,
  StateMachineState,
  StateMachineTransition,
} from "@/lib/api/types";

/** Data carried by a state node in React Flow. */
export type StateMachineNodeData = {
  /** State name (also serves as the React Flow node id). */
  name: string;
  description?: string;
  isInitial: boolean;
  isCurrent: boolean;
  isTerminal: boolean;
  hasEntry: boolean;
  hasExit: boolean;
};

/** Data carried by a transition edge in React Flow. */
export type StateMachineEdgeData = {
  /** Index in the `transitions[]` array on the root — primary key for edits. */
  index: number;
  name?: string | null;
  displayName?: string | null;
  hasCondition: boolean;
  hasTrigger: boolean;
  hasAction: boolean;
  /**
   * 0-based position of this transition among all transitions sharing the
   * same (from, to) pair. Used by `state-transition-edge.tsx` to fan parallel
   * edges out so they don't render on top of one another.
   */
  parallelIndex: number;
  /** Count of transitions sharing the same (from, to) pair. */
  parallelTotal: number;
};

/**
 * Converts an `Elsa.StateMachine` root into React Flow nodes + edges. Phase A
 * is read-only render: states become rectangular nodes, transitions become
 * labelled edges. Position falls back to a hand-rolled grid layout when the
 * activity JSON doesn't carry per-state designer positions (the .NET tier
 * doesn't yet, but we honor positions if they're already present from a prior
 * write — they round-trip as opaque metadata).
 */
export function buildStateMachineGraph(root: ActivityJson): {
  nodes: Node<StateMachineNodeData>[];
  edges: Edge<StateMachineEdgeData>[];
  isFlowchart: false;
  isStateMachine: true;
} {
  const states = (root.states as StateMachineState[] | undefined) ?? [];
  const transitions =
    (root.transitions as StateMachineTransition[] | undefined) ?? [];
  const initialState =
    typeof root.initialState === "string" ? root.initialState : null;
  const currentState =
    typeof root.currentState === "string" ? root.currentState : null;

  // Terminal = no outgoing transitions referencing this state's name.
  const outDegree = new Map<string, number>();
  for (const t of transitions) {
    outDegree.set(t.from, (outDegree.get(t.from) ?? 0) + 1);
  }

  // Compute auto-layout positions when designer positions are missing.
  const fallbackPositions = layoutStateMachineGrid(states.map((s) => s.name));

  const nodes: Node<StateMachineNodeData>[] = states.map((state) => {
    const stored = state.metadata?.designer?.position;
    const position =
      stored && typeof stored.x === "number" && typeof stored.y === "number"
        ? { x: stored.x, y: stored.y }
        : fallbackPositions.get(state.name) ?? { x: 0, y: 0 };
    return {
      // Use the state name as the React Flow node id. State names are unique
      // within a single StateMachine; React Flow needs a stable string id.
      id: state.name,
      type: "stateMachineState",
      position,
      data: {
        name: state.name,
        description: state.description,
        isInitial: initialState === state.name,
        isCurrent: currentState === state.name,
        isTerminal: (outDegree.get(state.name) ?? 0) === 0,
        hasEntry: !!state.entry,
        hasExit: !!state.exit,
      },
    };
  });

  // Two passes so parallel transitions can fan out symmetrically: count the
  // pair totals first, then assign each transition its 0-based slot within
  // that pair. The custom edge renderer uses these to bend each path along a
  // perpendicular offset so duplicates don't render on top of each other.
  const pairTotal = new Map<string, number>();
  for (const t of transitions) {
    const key = `${t.from}->${t.to}`;
    pairTotal.set(key, (pairTotal.get(key) ?? 0) + 1);
  }
  const pairSeq = new Map<string, number>();
  const edges: Edge<StateMachineEdgeData>[] = transitions.map((t, i) => {
    const key = `${t.from}->${t.to}`;
    const idx = pairSeq.get(key) ?? 0;
    pairSeq.set(key, idx + 1);
    const total = pairTotal.get(key) ?? 1;
    const label = t.displayName?.trim() || t.name?.trim() || undefined;
    return {
      id: `t-${i}-${t.from}->${t.to}`,
      source: t.from,
      target: t.to,
      type: "stateMachineTransition",
      label,
      data: {
        index: i,
        name: t.name ?? null,
        displayName: t.displayName ?? null,
        hasCondition: t.condition != null && t.condition !== false,
        hasTrigger: !!t.trigger,
        hasAction: !!t.action,
        parallelIndex: idx,
        parallelTotal: total,
      },
      style: { stroke: "var(--muted-foreground)" },
      labelStyle: { fontSize: 11, fill: "var(--muted-foreground)" },
      labelBgStyle: { fill: "var(--background)" },
    };
  });

  return { nodes, edges, isFlowchart: false, isStateMachine: true };
}
