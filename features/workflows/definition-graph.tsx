"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnConnectEnd,
  type OnConnectStart,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  LocateFixed,
  Maximize2,
  Plus,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ActivityNode, type ActivityNodeData } from "@/features/workflows/activity-node";
import { ACTIVITY_DRAG_MIME } from "@/features/workflows/activity-palette";
import type { ActivityStats } from "@/features/workflows/activity-stats";
import { alignSelected, type AlignAxis } from "@/features/workflows/align";
import {
  buildGraphFromRoot,
  isSequenceRoot,
  isStateMachineRoot,
} from "@/features/workflows/build-graph";
import { StateNode } from "@/features/workflows/state-node";
import { StateTransitionEdge } from "@/features/workflows/state-transition-edge";
import { layoutRootHappyPath } from "@/features/workflows/happy-path-layout";
import { layoutRootSequence } from "@/features/workflows/sequence-layout";
import { ConnectMenu } from "@/features/workflows/connect-menu";
import {
  getContainerAt,
  isFlowchartContainer,
  useEditorStore,
} from "@/features/workflows/editor-store";
import { EdgeOpsProvider, ElsaFlowEdge, type EdgeOps } from "@/features/workflows/elsa-edge";
import { syncFlowchart } from "@/features/workflows/graph-to-flowchart";
import { syncSequence } from "@/features/workflows/graph-to-sequence";
import type { StateMachineNodeData } from "@/features/workflows/build-state-machine-graph";
import { syncStateMachine } from "@/features/workflows/graph-to-state-machine";
import { makeActivity } from "@/features/workflows/make-activity";
import { SnapLinesOverlay, type SnapLines, computeSnapLines } from "@/features/workflows/snap-lines";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type { ActivityDescriptor, ActivityJson, WorkflowDefinition } from "@/lib/api/types";

const NODE_TYPES = { activity: ActivityNode, stateMachineState: StateNode };
const EDGE_TYPES = {
  smoothstep: ElsaFlowEdge,
  default: ElsaFlowEdge,
  stateMachineTransition: StateTransitionEdge,
};

type ConnectMenuState =
  | {
      kind: "fromPort";
      sourceNodeId: string;
      sourceHandleId: string | null;
      clientX: number;
      clientY: number;
    }
  | { kind: "spliceEdge"; edgeId: string; clientX: number; clientY: number }
  | { kind: "fromEmpty"; clientX: number; clientY: number }
  | null;

/** Module-level clipboard for canvas copy/paste. Lives across mount cycles. */
type ClipboardEntry = { activity: ActivityJson; position: { x: number; y: number } };
let canvasClipboard: ClipboardEntry[] = [];

type Props =
  | {
      definition: WorkflowDefinition;
      editable?: false;
      /** Stats keyed by activityId — feeds the instance viewer badges. */
      statsByActivityId?: Record<string, ActivityStats>;
      /**
       * Optional click hook for read-only canvases. Receives the activity id
       * (the React Flow node id) when the user clicks a node, or `null` when
       * the background is clicked. Used by the alteration designer to drive
       * its Selection tab.
       */
      onActivityClick?: (activityId: string | null) => void;
    }
  | {
      definition?: undefined;
      editable: true;
      statsByActivityId?: never;
      onActivityClick?: never;
    };

function EditableCanvas() {
  const workflowRoot = useEditorStore((s) => s.definition?.root);
  const containerStack = useEditorStore((s) => s.containerStack);
  const setContainerRoot = useEditorStore((s) => s.setContainerRoot);
  const setSelectedActivityId = useEditorStore((s) => s.setSelectedActivityId);
  const enterContainer = useEditorStore((s) => s.enterContainer);
  const descriptors = useActivityDescriptors();
  const flow = useReactFlow<Node<ActivityNodeData>, Edge>();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Resolve the currently-active container by walking the stack from the
  // workflow root. When the stack is empty, this is just the workflow root.
  const root = useMemo(() => {
    if (!workflowRoot) return undefined;
    if (containerStack.length === 0) return workflowRoot;
    return getContainerAt(workflowRoot, containerStack);
  }, [workflowRoot, containerStack]);

  // Seed from the current root; we hold local node/edge state to keep React
  // Flow gestures cheap, then sync back to the store on mouseup / connect /
  // delete.
  const built = useMemo(
    () => (root ? buildGraphFromRoot(root) : { nodes: [], edges: [], isFlowchart: false }),
    [root],
  );
  const [nodes, setNodes] = useState<Node<ActivityNodeData>[]>(built.nodes);
  const [edges, setEdges] = useState<Edge[]>(built.edges);
  const rootIsStateMachine = !!root && isStateMachineRoot(root);
  const rootIsSequence = !!root && isSequenceRoot(root);
  const setSelectedTransitionIndex = useEditorStore(
    (s) => s.setSelectedTransitionIndex,
  );
  const [snapLines, setSnapLines] = useState<SnapLines | null>(null);
  const [connectMenu, setConnectMenu] = useState<ConnectMenuState>(null);
  const [highlightedSpliceEdgeId, setHighlightedSpliceEdgeId] = useState<string | null>(null);
  const connectSourceRef = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const pendingSpliceEdgeIdRef = useRef<string | null>(null);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);

  // Hydrate on root identity change (e.g. after save → server returns new root).
  const lastRoot = useRef<ActivityJson | null>(root ?? null);
  useEffect(() => {
    if (lastRoot.current === root) return;
    lastRoot.current = root ?? null;
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [root, built.nodes, built.edges]);

  /** Snapshot the current store root, then push the synced graph back. */
  const commit = useCallback(
    (nextNodes: Node<ActivityNodeData>[], nextEdges: Edge[]) => {
      if (!root) return;
      useEditorStore.getState().pushSnapshot();
      let synced: ActivityJson;
      if (isStateMachineRoot(root)) {
        synced = syncStateMachine(
          root,
          nextNodes as unknown as Node<StateMachineNodeData>[],
        );
      } else if (isSequenceRoot(root)) {
        synced = syncSequence(root, nextNodes);
      } else {
        synced = syncFlowchart(root, nextNodes, nextEdges);
      }
      setContainerRoot(synced);
    },
    [root, setContainerRoot],
  );

  /** Descriptor map keyed by typeName — feeds the happy-path port-order tie-breaker. */
  const descriptorIndex = useMemo(() => {
    const map = new Map<string, ActivityDescriptor>();
    for (const d of descriptors.data ?? []) map.set(d.typeName, d);
    return map;
  }, [descriptors.data]);

  /**
   * Same as `commit`, but routes the result through the **same** happy-path
   * layout the toolbar's "Auto-layout" button uses, so the on-insert and
   * manual rearrange produce identical results.
   *
   * The flow is: sync the local nodes/edges into the root → run
   * `layoutRootHappyPath` on the root → set the laid-out root → mirror the
   * new positions onto local nodes so the canvas re-arranges in-frame
   * without flickering through the pre-layout state.
   *
   * Using the root-level helper (which rebuilds nodes via `buildGraphFromRoot`)
   * keeps column widths deterministic: both code paths see the same default
   * 240 px column width regardless of whether React Flow has measured the
   * live nodes yet.
   */
  const commitWithLayout = useCallback(
    (nextNodes: Node<ActivityNodeData>[], nextEdges: Edge[]) => {
      if (!root) return;
      // State Machine roots don't participate in drop-on-edge splicing, so we
      // don't need a layout-on-insert path here. Fall through to a position-
      // only commit when one slips through.
      if (isStateMachineRoot(root)) {
        useEditorStore.getState().pushSnapshot();
        setContainerRoot(
          syncStateMachine(
            root,
            nextNodes as unknown as Node<StateMachineNodeData>[],
          ),
        );
        return;
      }
      useEditorStore.getState().pushSnapshot();
      const sequence = isSequenceRoot(root);
      const synced = sequence
        ? syncSequence(root, nextNodes)
        : syncFlowchart(root, nextNodes, nextEdges);
      // For Flowchart roots, only run a full happy-path layout when the
      // existing activities have NO persisted designer positions — i.e. the
      // graph is being arranged for the first time. Once the user has placed
      // nodes manually, re-running layout on every drop-on-edge would wipe
      // their arrangement. Sequences always re-layout (they're linear and
      // ordering is positional).
      const shouldLayout =
        sequence ||
        !(synced.activities ?? []).some(
          (a) => a.metadata?.designer?.position != null,
        );
      const laidOutRoot = !shouldLayout
        ? synced
        : sequence
          ? layoutRootSequence(synced)
          : layoutRootHappyPath(synced, descriptorIndex);
      setContainerRoot(laidOutRoot);
      // Mirror laid-out positions into local state so the user sees the new
      // layout this frame — `useEffect` will reconcile on the next render
      // anyway, but skipping the flicker matters.
      const positions = new Map<string, { x: number; y: number }>();
      for (const a of laidOutRoot.activities ?? []) {
        const p = a.metadata?.designer?.position;
        if (p && typeof p.x === "number" && typeof p.y === "number") {
          positions.set(a.id, { x: p.x, y: p.y });
        }
      }
      const positioned = nextNodes.map((n) => {
        const p = positions.get(n.id);
        return p ? { ...n, position: p } : n;
      });
      setNodes(positioned);
      setEdges(nextEdges);
    },
    [root, setContainerRoot, descriptorIndex],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<ActivityNodeData>>[]) => {
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds);
        // Only commit "settle" events: position once dragging finishes, or
        // structural changes (remove). Skip per-pixel updates to avoid
        // thrashing the store.
        const settled = changes.some(
          (c) =>
            (c.type === "position" && c.dragging === false) ||
            c.type === "remove",
        );
        // Defer the store write out of React's render phase — setState
        // updaters run during reconciliation, and writing to a separate
        // store from there triggers "setState during render" warnings.
        if (settled) queueMicrotask(() => commit(next, edges));
        // If a node was removed and it was the selection, clear it.
        const removedIds = changes.filter((c) => c.type === "remove").map((c) => c.id);
        if (removedIds.length > 0) {
          const cur = useEditorStore.getState().selectedActivityId;
          if (cur && removedIds.includes(cur)) {
            queueMicrotask(() => setSelectedActivityId(null));
          }
        }
        return next;
      });
    },
    [commit, edges, setSelectedActivityId],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      setEdges((eds) => {
        const next = applyEdgeChanges(changes, eds);
        const settled = changes.some((c) => c.type === "remove");
        if (settled) queueMicrotask(() => commit(nodes, next));
        return next;
      });
    },
    [commit, nodes],
  );

  const addStateMachineTransition = useEditorStore(
    (s) => s.addStateMachineTransition,
  );

  /**
   * React Flow's "drag an edge endpoint to a new node" gesture. Re-routes the
   * existing edge instead of creating a new one. Disabled for State Machine
   * roots since transitions are addressed by from/to name rather than nodeId
   * — re-routing would require a renameTransitionEndpoints store action that
   * we'll add in Phase B/C.
   */
  const onReconnect = useCallback(
    (oldEdge: Edge, newConn: Connection) => {
      if (rootIsStateMachine) return;
      if (!newConn.source || !newConn.target) return;
      setEdges((eds) => {
        const next = eds.map((e) =>
          e.id === oldEdge.id
            ? {
                ...e,
                source: newConn.source ?? e.source,
                target: newConn.target ?? e.target,
                sourceHandle: newConn.sourceHandle ?? undefined,
                targetHandle: newConn.targetHandle ?? undefined,
              }
            : e,
        );
        queueMicrotask(() => commit(nodes, next));
        return next;
      });
    },
    [commit, nodes, rootIsStateMachine],
  );

  /**
   * Reject obviously bad connect attempts before they hit `onConnect`. Mirrors
   * Blazor's `isValidConnection`:
   *  - no self-loops (a node connecting to itself)
   *  - flowchart edges must go from an out-port to an in-port; ReactFlow
   *    encodes input handles with `type="target"` and the activity node uses
   *    `null` source-handle for the input slot. We can't see the handle type
   *    from `Connection` alone, but Activity nodes label their target handle
   *    `null` and source handles by the port name, so accept when at least
   *    the source side names a port (or `null` for the synthetic Done) and
   *    the target side is `null` (the input slot).
   *
   *  For state-machine roots we just need to block self-loops — transitions
   *  to-self are technically valid but vanishingly rare.
   */
  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      const source = "source" in conn ? conn.source : null;
      const target = "target" in conn ? conn.target : null;
      if (!source || !target) return false;
      if (source === target) return false;
      if (rootIsStateMachine) return true;
      // For flowcharts the activity node renders one input handle on the left
      // (no handleId — it's the default target) and one or more output handles
      // on the right. ReactFlow swaps source/target when you drag from a
      // target handle, so by the time onConnect fires the source has to be
      // an out-side handle. The simplest invariant: source has a handle id
      // (an out port name) OR no source handle (legitimate when the source
      // node has no declared ports). Reject when the target handle is non-null
      // — that's a sign the user dragged onto another out-handle.
      const targetHandle = "targetHandle" in conn ? conn.targetHandle : null;
      if (targetHandle) return false;
      return true;
    },
    [rootIsStateMachine],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      // State machines have their own data model — connect-gesture creates a
      // transition in `root.transitions[]` rather than a Flowchart edge. The
      // updated graph re-derives edges from JSON on the next render, so we
      // skip the local React Flow edge write here.
      if (rootIsStateMachine) {
        if (!params.source || !params.target) return;
        addStateMachineTransition(params.source, params.target);
        return;
      }
      const id = `e-${params.source}-${params.target}-${params.sourceHandle ?? "out"}-${params.targetHandle ?? "in"}-${Date.now()}`;
      setEdges((eds) => {
        const next = addEdge(
          {
            ...params,
            id,
            type: "smoothstep",
            style: { stroke: "var(--muted-foreground)" },
          },
          eds,
        );
        queueMicrotask(() => commit(nodes, next));
        return next;
      });
    },
    [commit, nodes, rootIsStateMachine, addStateMachineTransition],
  );

  /** Look up the edge id under the cursor by piercing through ReactFlow's DOM. */
  const findEdgeUnderCursor = useCallback((clientX: number, clientY: number): string | null => {
    const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const edgeEl = el?.closest(".react-flow__edge") as HTMLElement | null;
    return edgeEl?.getAttribute("data-id") ?? null;
  }, []);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(ACTIVITY_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      if (readOnly) return;
      const edgeId = findEdgeUnderCursor(e.clientX, e.clientY);
      if (pendingSpliceEdgeIdRef.current !== edgeId) {
        pendingSpliceEdgeIdRef.current = edgeId;
        setHighlightedSpliceEdgeId(edgeId);
      }
    },
    [findEdgeUnderCursor, readOnly],
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    // Only clear when leaving the canvas wrapper itself — not child crossings.
    const related = e.relatedTarget as globalThis.Node | null;
    if (related && wrapper.contains(related)) return;
    pendingSpliceEdgeIdRef.current = null;
    setHighlightedSpliceEdgeId(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const spliceEdgeId = pendingSpliceEdgeIdRef.current;
      pendingSpliceEdgeIdRef.current = null;
      setHighlightedSpliceEdgeId(null);
      const typeName = e.dataTransfer.getData(ACTIVITY_DRAG_MIME);
      if (!typeName) return;
      const descriptor = descriptors.data?.find((d) => d.typeName === typeName);
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const bounds = wrapper.getBoundingClientRect();
      const position = flow.screenToFlowPosition({
        x: e.clientX - bounds.left,
        y: e.clientY - bounds.top,
      });
      // When splicing onto an edge, ignore the cursor position and place the
      // new node inline between the two endpoints. Falls back to cursor
      // position for a plain drop onto the pane.
      const oldEdge = spliceEdgeId ? findEdge(edges, spliceEdgeId) : undefined;
      const sourceNode = oldEdge ? nodes.find((n) => n.id === oldEdge.source) : undefined;
      const targetNode = oldEdge ? nodes.find((n) => n.id === oldEdge.target) : undefined;
      let placedPosition = position;
      if (oldEdge) {
        if (sourceNode && targetNode) placedPosition = midpointBetween(sourceNode, targetNode);
        else if (sourceNode) placedPosition = rightOf(sourceNode);
      }
      const newActivity = makeActivity(
        typeName,
        descriptor,
        placedPosition,
        root?.nodeId ?? "",
        workflowRoot ?? null,
      );
      const newNode: Node<ActivityNodeData> = {
        id: newActivity.id,
        type: "activity",
        position: placedPosition,
        selected: true,
        data: {
          label: (newActivity.metadata?.displayText as string) ?? shortTypeName(typeName),
          typeName,
          typeShort: shortTypeName(typeName),
        },
      };
      const cleared = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
      const nextNodes = [...cleared, newNode];
      if (oldEdge) {
        // Splice path: re-arrange so the new node slots inline between source
        // and target instead of overlapping the existing target node.
        const nextEdges = spliceEdge(edges, oldEdge, newNode.id);
        commitWithLayout(nextNodes, nextEdges);
        return;
      }
      // Plain pane drop: keep the user's chosen position, no layout pass.
      setNodes(nextNodes);
      commit(nextNodes, edges);
    },
    [
      descriptors.data,
      edges,
      nodes,
      commit,
      commitWithLayout,
      flow,
      root?.nodeId,
      workflowRoot,
    ],
  );

  /**
   * Resolve a node id back to its ActivityJson from the current root, so we
   * can clone the full activity (including configured inputs, metadata,
   * embedded children) rather than the React Flow visual shell.
   */
  const findActivityInRoot = useCallback(
    (id: string): ActivityJson | undefined => {
      if (!root) return undefined;
      return (root.activities ?? []).find((a) => a.id === id);
    },
    [root],
  );


  /** Copy the currently-selected nodes' activities to the clipboard. */
  const copySelection = useCallback(() => {
    const selected = nodes.filter((n) => n.selected);
    if (selected.length === 0) return;
    canvasClipboard = selected
      .map((n) => {
        const activity = findActivityInRoot(n.id);
        if (!activity) return null;
        return { activity, position: { x: n.position.x, y: n.position.y } };
      })
      .filter((x): x is ClipboardEntry => x !== null);
  }, [nodes, findActivityInRoot]);

  /**
   * Paste clipboard contents at +24px offset, push to root, select the new
   * activities so the user can drag the group.
   */
  const pasteClipboard = useCallback(() => {
    if (canvasClipboard.length === 0) return;
    const OFFSET = 24;
    const newActivities: ActivityJson[] = canvasClipboard.map((entry) => {
      const fresh = cloneActivityWithFreshIds(entry.activity);
      const md = (fresh.metadata ?? {}) as Record<string, unknown>;
      const designer =
        (md.designer && typeof md.designer === "object"
          ? (md.designer as Record<string, unknown>)
          : {}) ?? {};
      fresh.metadata = {
        ...md,
        designer: {
          ...designer,
          position: {
            x: Math.round(entry.position.x + OFFSET),
            y: Math.round(entry.position.y + OFFSET),
          },
        },
      };
      return fresh;
    });
    const newNodes: Node<ActivityNodeData>[] = newActivities.map((a) => ({
      id: a.id,
      type: "activity",
      position: {
        x: ((a.metadata?.designer?.position?.x as number | undefined) ?? 0),
        y: ((a.metadata?.designer?.position?.y as number | undefined) ?? 0),
      },
      selected: true,
      data: {
        label: (a.metadata?.displayText as string | undefined) ?? shortTypeName(a.type),
        typeName: a.type,
        typeShort: shortTypeName(a.type),
      },
    }));
    setNodes((nds) => {
      // Deselect existing nodes; the pasted group becomes the new selection.
      const cleared = nds.map((n) => (n.selected ? { ...n, selected: false } : n));
      const next = [...cleared, ...newNodes];
      // Defer the store write out of React's render phase.
      queueMicrotask(() => commit(next, edges));
      return next;
    });
  }, [edges, commit]);

  /** Duplicate selection in place (copy + paste shorthand). */
  const duplicateSelection = useCallback(() => {
    copySelection();
    pasteClipboard();
  }, [copySelection, pasteClipboard]);

  /** Snap-line tracking driven by ReactFlow's drag callbacks. */
  const onNodeDrag = useCallback(
    (_e: unknown, node: Node<ActivityNodeData>) => {
      const live = nodes.find((n) => n.id === node.id) ?? node;
      setSnapLines(computeSnapLines({ ...live, position: node.position }, nodes));
    },
    [nodes],
  );

  const onNodeDragStop = useCallback(() => {
    setSnapLines(null);
  }, []);

  /** Align the current multi-selection along an axis. */
  const onAlign = useCallback(
    (axis: AlignAxis) => {
      setNodes((nds) => {
        const next = alignSelected(nds, axis);
        if (next !== nds) queueMicrotask(() => commit(next, edges));
        return next;
      });
    },
    [commit, edges],
  );

  // -- Connect-to-create + insert-on-edge -----------------------------------

  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    if (!params.nodeId) {
      connectSourceRef.current = null;
      return;
    }
    connectSourceRef.current = {
      nodeId: params.nodeId,
      handleId: params.handleId ?? null,
    };
  }, []);

  const onConnectEnd: OnConnectEnd = useCallback(
    (event) => {
      const drag = connectSourceRef.current;
      connectSourceRef.current = null;
      if (readOnly || !drag) return;
      // If the user released on a handle/node, onConnect already wired it.
      const target = event.target as HTMLElement | null;
      if (target?.closest(".react-flow__handle, .react-flow__node")) return;
      const clientX =
        (event as MouseEvent).clientX ??
        (event as TouchEvent).changedTouches?.[0]?.clientX ??
        0;
      const clientY =
        (event as MouseEvent).clientY ??
        (event as TouchEvent).changedTouches?.[0]?.clientY ??
        0;
      setConnectMenu({
        kind: "fromPort",
        sourceNodeId: drag.nodeId,
        sourceHandleId: drag.handleId,
        clientX,
        clientY,
      });
    },
    [readOnly],
  );

  /** Convert a screen-space click into flow-space, accounting for the wrapper offset. */
  const clientToFlow = useCallback(
    (clientX: number, clientY: number) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return { x: 0, y: 0 };
      const bounds = wrapper.getBoundingClientRect();
      return flow.screenToFlowPosition({
        x: clientX - bounds.left,
        y: clientY - bounds.top,
      });
    },
    [flow],
  );

  /** Create a fresh activity placed at the given flow-space position. */
  const insertActivityAt = useCallback(
    (
      descriptor: ActivityDescriptor,
      position: { x: number; y: number },
    ): { node: Node<ActivityNodeData>; activity: ActivityJson } | null => {
      if (!root) return null;
      const activity = makeActivity(
        descriptor.typeName,
        descriptor,
        position,
        root.nodeId ?? "",
        workflowRoot ?? null,
      );
      const node: Node<ActivityNodeData> = {
        id: activity.id,
        type: "activity",
        position,
        selected: true,
        data: {
          label: (activity.metadata?.displayText as string | undefined) ?? shortTypeName(descriptor.typeName),
          typeName: descriptor.typeName,
          typeShort: shortTypeName(descriptor.typeName),
        },
      };
      return { node, activity };
    },
    [root, workflowRoot],
  );

  const onConnectMenuPick = useCallback(
    (descriptor: ActivityDescriptor) => {
      const menu = connectMenu;
      if (!menu) return;
      setConnectMenu(null);

      if (menu.kind === "fromEmpty") {
        const pos = clientToFlow(menu.clientX, menu.clientY);
        const placed = insertActivityAt(descriptor, pos);
        if (!placed) return;
        setNodes((nds) => {
          const cleared = nds.map((n) => (n.selected ? { ...n, selected: false } : n));
          const nextNodes = [...cleared, placed.node];
          queueMicrotask(() => commit(nextNodes, edges));
          return nextNodes;
        });
        return;
      }

      if (menu.kind === "fromPort") {
        // Place inline to the right of the source node, same Y.
        const source = nodes.find((n) => n.id === menu.sourceNodeId);
        const pos = source
          ? rightOf(source)
          : clientToFlow(menu.clientX, menu.clientY);
        const placed = insertActivityAt(descriptor, pos);
        if (!placed) return;
        const newEdge: Edge = {
          id: `e-${menu.sourceNodeId}-${placed.node.id}-${menu.sourceHandleId ?? "Done"}-${Date.now()}`,
          source: menu.sourceNodeId,
          target: placed.node.id,
          sourceHandle: menu.sourceHandleId ?? "Done",
          type: "smoothstep",
          style: { stroke: "var(--muted-foreground)" },
        };
        const cleared = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
        const nextNodes = [...cleared, placed.node];
        const nextEdges = [...edges, newEdge];
        commitWithLayout(nextNodes, nextEdges);
        return;
      }

      if (menu.kind === "spliceEdge") {
        const oldEdge = findEdge(edges, menu.edgeId);
        const source = oldEdge ? nodes.find((n) => n.id === oldEdge.source) : undefined;
        const target = oldEdge ? nodes.find((n) => n.id === oldEdge.target) : undefined;
        const pos =
          source && target
            ? midpointBetween(source, target)
            : source
              ? rightOf(source)
              : clientToFlow(menu.clientX, menu.clientY);
        const placed = insertActivityAt(descriptor, pos);
        if (!placed) return;
        const cleared = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
        const nextNodes = [...cleared, placed.node];
        const nextEdges = oldEdge
          ? spliceEdge(edges, oldEdge, placed.node.id)
          : [...edges];
        commitWithLayout(nextNodes, nextEdges);
      }
    },
    [connectMenu, insertActivityAt, clientToFlow, commit, commitWithLayout, edges, nodes],
  );

  /** Open the ConnectMenu anchored at the canvas center — used for the empty-state CTA. */
  const openEmptyStateMenu = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const bounds = wrapper.getBoundingClientRect();
    setConnectMenu({
      kind: "fromEmpty",
      clientX: bounds.left + bounds.width / 2,
      clientY: bounds.top + bounds.height / 2,
    });
  }, []);

  const edgeOps = useMemo<EdgeOps>(
    () => ({
      readOnly,
      highlightedEdgeId: highlightedSpliceEdgeId,
      deleteEdge: (edgeId) => {
        setEdges((eds) => {
          const next = eds.filter((e) => e.id !== edgeId);
          if (next.length !== eds.length) queueMicrotask(() => commit(nodes, next));
          return next;
        });
      },
      requestInsertActivity: (edgeId, clientX, clientY) => {
        if (readOnly) return;
        setConnectMenu({ kind: "spliceEdge", edgeId, clientX, clientY });
      },
      updateEdgeVertices: (edgeId, vertices) => {
        if (readOnly) return;
        setEdges((eds) => {
          let changed = false;
          const next = eds.map((e) => {
            if (e.id !== edgeId) return e;
            changed = true;
            const prevData = (e.data ?? {}) as Record<string, unknown>;
            if (!vertices || vertices.length === 0) {
              // Strip the vertices key but keep any other data fields.
              const { vertices: _drop, ...rest } = prevData as {
                vertices?: unknown;
                [k: string]: unknown;
              };
              void _drop;
              return { ...e, data: Object.keys(rest).length > 0 ? rest : undefined };
            }
            return { ...e, data: { ...prevData, vertices } };
          });
          if (changed) queueMicrotask(() => commit(nodes, next));
          return next;
        });
      },
    }),
    [commit, nodes, readOnly, highlightedSpliceEdgeId],
  );

  const selectedCount = nodes.filter((n) => n.selected).length;

  // Canvas-scoped hotkeys. Skip when the user is typing into an input.
  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const onKey = (e: KeyboardEvent) => {
      // State-machine canvases get a custom Delete/Backspace route because
      // React Flow's native deletion can't address `from`/`to`-by-name
      // transitions or state-by-name nodes. Skip when typing.
      if (
        rootIsStateMachine &&
        (e.key === "Delete" || e.key === "Backspace") &&
        !isEditableTarget(e.target)
      ) {
        const store = useEditorStore.getState();
        if (store.selectedTransitionIndex != null) {
          e.preventDefault();
          store.removeStateMachineTransitionByIndex(store.selectedTransitionIndex);
          return;
        }
        if (store.selectedActivityId != null) {
          e.preventDefault();
          store.removeStateMachineState(store.selectedActivityId);
          return;
        }
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || isEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "c") {
        copySelection();
      } else if (key === "v") {
        e.preventDefault();
        pasteClipboard();
      } else if (key === "d") {
        e.preventDefault();
        duplicateSelection();
      } else if (key === "x") {
        // Cut = copy + remove each selected node. Each removal snapshots so
        // undo restores them one at a time; could be combined into a single
        // snapshot later, but parity-with-Blazor is fine for now.
        e.preventDefault();
        const ids = nodes.filter((n) => n.selected).map((n) => n.id);
        if (ids.length === 0) return;
        copySelection();
        const remove = useEditorStore.getState().removeActivityById;
        for (const id of ids) remove(id);
      } else if (key === "a") {
        // Select-all is local React Flow state — the editor store doesn't
        // carry multi-selection, so no commit is needed.
        e.preventDefault();
        setNodes((nds) => nds.map((n) => (n.selected ? n : { ...n, selected: true })));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copySelection, pasteClipboard, duplicateSelection, nodes, rootIsStateMachine]);

  return (
    <EdgeOpsProvider ops={edgeOps}>
      <div
        ref={wrapperRef}
        className="size-full"
        onDragOver={rootIsStateMachine ? undefined : onDragOver}
        onDragLeave={rootIsStateMachine ? undefined : onDragLeave}
        onDrop={rootIsStateMachine ? undefined : onDrop}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={rootIsStateMachine ? undefined : onConnectStart}
          onConnectEnd={rootIsStateMachine ? undefined : onConnectEnd}
          onReconnect={rootIsStateMachine ? undefined : onReconnect}
          isValidConnection={isValidConnection}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={(_, n) => setSelectedActivityId(n.id)}
          onNodeDoubleClick={(_, n) => {
            const activities = root?.activities ?? [];
            const child = activities.find((a) => a.id === n.id);
            if (child && isFlowchartContainer(child)) {
              const displayName =
                (child.metadata?.displayText as string | undefined) ??
                shortTypeName(child.type ?? "Flowchart");
              enterContainer(child.id, displayName);
            }
          }}
          onEdgeClick={
            rootIsStateMachine
              ? (_, e) => {
                  // State machine transition edges carry their array index in
                  // `data.index` so the properties panel can look the
                  // transition up directly on the root.
                  const idx = (e.data as { index?: number } | undefined)?.index;
                  if (typeof idx === "number") setSelectedTransitionIndex(idx);
                }
              : undefined
          }
          onPaneClick={() => {
            setSelectedActivityId(null);
            if (rootIsStateMachine) setSelectedTransitionIndex(null);
          }}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={1.8}
          nodesDraggable
          nodesConnectable={!rootIsSequence}
          elementsSelectable
          selectionOnDrag
          multiSelectionKeyCode={["Shift", "Meta", "Control"]}
          deleteKeyCode={rootIsStateMachine ? null : ["Backspace", "Delete"]}
          panActivationKeyCode={null}
          defaultEdgeOptions={{ type: "smoothstep" }}
        >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        <MiniMap
          pannable
          zoomable
          className="!bg-card !border-border rounded-md border"
          nodeColor={(n) =>
            (n.data as { canStartWorkflow?: boolean } | undefined)?.canStartWorkflow ||
            (n.data as { isStart?: boolean } | undefined)?.isStart
              ? "var(--primary)"
              : "var(--muted)"
          }
          maskColor="color-mix(in oklch, var(--background) 70%, transparent)"
        />
        <Controls
          className="!bg-card !border-border rounded-md border !shadow-sm"
          showInteractive={false}
        />
        <ZoomBadge />
        <ViewportButtons />
        {rootIsStateMachine && !readOnly ? (
          <Panel position="top-left" className="!m-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                // Place the new state near the centre of the current viewport
                // so it lands on-screen even after the user has panned away.
                const vp = flow.getViewport();
                const wrapper = wrapperRef.current;
                if (!wrapper) {
                  useEditorStore.getState().addStateMachineState();
                  return;
                }
                const bounds = wrapper.getBoundingClientRect();
                const center = flow.screenToFlowPosition({
                  x: bounds.left + bounds.width / 2,
                  y: bounds.top + bounds.height / 2,
                });
                void vp;
                useEditorStore.getState().addStateMachineState(center);
              }}
            >
              <Plus className="size-3.5" /> Add state
            </Button>
          </Panel>
        ) : null}
        <SnapLinesOverlay lines={snapLines} />
        {nodes.length === 0 && !readOnly ? (
          <Panel position="top-center" className="!m-0 !mt-16">
            <button
              type="button"
              onClick={openEmptyStateMenu}
              className="bg-card hover:bg-accent flex items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm shadow-sm transition-colors"
            >
              <Plus className="size-4" />
              <span className="flex flex-col text-left leading-tight">
                <span className="font-medium">Add an activity</span>
                <span className="text-muted-foreground text-xs">
                  or drag one from the palette
                </span>
              </span>
            </button>
          </Panel>
        ) : null}
        {selectedCount >= 2 ? (
          <Panel position="top-center" className="!m-2">
            <div className="bg-card flex items-center gap-0.5 rounded-md border px-1.5 py-1 shadow-sm">
              <span className="text-muted-foreground mr-1 text-2xs font-medium uppercase tracking-wide">
                Align
              </span>
              <AlignButton axis="left" label="Align left" onClick={onAlign}>
                <AlignStartVertical className="size-3.5" />
              </AlignButton>
              <AlignButton axis="center-x" label="Align horizontal center" onClick={onAlign}>
                <AlignCenterVertical className="size-3.5" />
              </AlignButton>
              <AlignButton axis="right" label="Align right" onClick={onAlign}>
                <AlignEndVertical className="size-3.5" />
              </AlignButton>
              <span className="mx-1 h-4 w-px bg-border" />
              <AlignButton axis="top" label="Align top" onClick={onAlign}>
                <AlignStartHorizontal className="size-3.5" />
              </AlignButton>
              <AlignButton axis="center-y" label="Align vertical center" onClick={onAlign}>
                <AlignCenterHorizontal className="size-3.5" />
              </AlignButton>
              <AlignButton axis="bottom" label="Align bottom" onClick={onAlign}>
                <AlignEndHorizontal className="size-3.5" />
              </AlignButton>
            </div>
          </Panel>
        ) : null}
        </ReactFlow>
        {connectMenu ? (
          <ConnectMenu
            clientX={connectMenu.clientX}
            clientY={connectMenu.clientY}
            onPick={onConnectMenuPick}
            onClose={() => setConnectMenu(null)}
          />
        ) : null}
      </div>
    </EdgeOpsProvider>
  );
}

/** Floating zoom-percentage indicator (bottom-right of the canvas). */
function ZoomBadge() {
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-right" className="!m-2">
      <div className="bg-card text-muted-foreground rounded-md border px-2 py-1 font-mono text-2xs shadow-sm">
        {Math.round((zoom ?? 1) * 100)}%
      </div>
    </Panel>
  );
}

/** Fit-to-view and re-centre buttons (top-right of the canvas). */
function ViewportButtons() {
  const rf = useReactFlow();
  const onFit = useCallback(() => {
    rf.fitView({ padding: 0.2, duration: 250 });
  }, [rf]);
  const onCenter = useCallback(() => {
    const nodes = rf.getNodes();
    if (nodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const w = n.measured?.width ?? n.width ?? 0;
      const h = n.measured?.height ?? n.height ?? 0;
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
      if (n.position.x + w > maxX) maxX = n.position.x + w;
      if (n.position.y + h > maxY) maxY = n.position.y + h;
    }
    if (!Number.isFinite(minX)) return;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    rf.setCenter(midX, midY, { zoom: rf.getZoom(), duration: 250 });
  }, [rf]);
  return (
    <Panel position="top-right" className="!m-2">
      <div className="bg-card flex items-center gap-0.5 rounded-md border px-1.5 py-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Fit to view"
          aria-label="Fit to view"
          onClick={onFit}
        >
          <Maximize2 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Re-centre"
          aria-label="Re-centre"
          onClick={onCenter}
        >
          <LocateFixed className="size-3.5" />
        </Button>
      </div>
    </Panel>
  );
}

function AlignButton({
  axis,
  label,
  onClick,
  children,
}: {
  axis: AlignAxis;
  label: string;
  onClick: (axis: AlignAxis) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => onClick(axis)}
    >
      {children}
    </Button>
  );
}

function ReadOnlyCanvas({
  definition,
  statsByActivityId,
  onActivityClick,
}: {
  definition: WorkflowDefinition;
  statsByActivityId?: Record<string, ActivityStats>;
  onActivityClick?: (activityId: string | null) => void;
}) {
  const setSelectedActivityId = useEditorStore((s) => s.setSelectedActivityId);
  const selectedActivityId = useEditorStore((s) => s.selectedActivityId);
  const rf = useReactFlow<Node<ActivityNodeData>, Edge>();

  const built = useMemo(
    () => buildGraphFromRoot(definition.root, { statsByActivityId }),
    [definition.root, statsByActivityId],
  );
  // Keep a local copy so we can mark a node `.selected` in response to
  // external selection changes (e.g. clicking the crosshair button on an
  // incident, or selecting a journal row). Without this the visual ring on
  // the card never fires for non-click selections.
  const [nodes, setNodes] = useState<Node<ActivityNodeData>[]>(built.nodes);
  const [edges, setEdges] = useState<Edge[]>(built.edges);

  // Re-seed when the definition (or stats) change.
  useEffect(() => {
    setNodes(built.nodes);
    setEdges(built.edges);
  }, [built.nodes, built.edges]);

  // Mirror editor-store selection onto the React Flow nodes so the activity
  // card's selection ring lights up whether the user clicked the canvas,
  // clicked a journal row, or clicked the crosshair on an incident.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const want = n.id === selectedActivityId;
        return n.selected === want ? n : { ...n, selected: want };
      }),
    );
  }, [selectedActivityId]);

  // Pan/zoom to the selected node when selection changes externally. Skip
  // the centering when the node is already inside the viewport so a routine
  // canvas click doesn't yank the view around.
  const lastCenteredIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedActivityId) {
      lastCenteredIdRef.current = null;
      return;
    }
    if (lastCenteredIdRef.current === selectedActivityId) return;
    const target = nodes.find((n) => n.id === selectedActivityId);
    if (!target) return;
    const width = target.measured?.width ?? target.width ?? 220;
    const height = target.measured?.height ?? target.height ?? 80;
    const cx = target.position.x + width / 2;
    const cy = target.position.y + height / 2;
    rf.setCenter(cx, cy, { zoom: Math.max(rf.getZoom(), 0.75), duration: 350 });
    lastCenteredIdRef.current = selectedActivityId;
  }, [selectedActivityId, nodes, rf]);

  const handleNodeClick = onActivityClick
    ? (_: unknown, n: Node<ActivityNodeData>) => onActivityClick(n.id)
    : (_: unknown, n: Node<ActivityNodeData>) => setSelectedActivityId(n.id);
  const handlePaneClick = onActivityClick
    ? () => onActivityClick(null)
    : () => setSelectedActivityId(null);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      minZoom={0.2}
      maxZoom={1.8}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      defaultEdgeOptions={{ type: "smoothstep" }}
      onNodeClick={handleNodeClick}
      onPaneClick={handlePaneClick}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
      <MiniMap
        pannable
        zoomable
        className="!bg-card !border-border rounded-md border"
        nodeColor={() => "var(--muted)"}
        maskColor="color-mix(in oklch, var(--background) 70%, transparent)"
      />
      <Controls
        className="!bg-card !border-border rounded-md border !shadow-sm"
        showInteractive={false}
      />
      <ViewportButtons />
    </ReactFlow>
  );
}

export function DefinitionGraph(props: Props) {
  const storeDefinition = useEditorStore((s) => s.definition);
  const definition = props.definition ?? storeDefinition;
  const editable = props.editable === true;

  if (!definition) return null;

  const isFlowchart =
    typeof definition.root.type === "string" &&
    (definition.root.type.endsWith(".Flowchart") || definition.root.type === "Flowchart");
  const isSequence = isSequenceRoot(definition.root);
  const isStateMachine = isStateMachineRoot(definition.root);

  return (
    <div className="flex h-full flex-col">
      {!isFlowchart && !isSequence && !isStateMachine ? (
        <div className="bg-muted/40 text-muted-foreground border-b px-4 py-2 text-xs">
          This workflow uses a <code>{definition.root.type}</code> root — only the root activity is
          shown. Full structure support for non-Flowchart workflows is coming.
        </div>
      ) : null}
      {isStateMachine ? (
        <div className="bg-muted/40 text-muted-foreground border-b px-4 py-2 text-xs">
          State Machine canvas — add states from the toolbar; drag between
          handles to create transitions. Renaming states, editing transition
          fields, and entry/exit slot editing are coming.
        </div>
      ) : null}
      {isSequence ? (
        <div className="bg-muted/40 text-muted-foreground border-b px-4 py-2 text-xs">
          Sequence canvas — activities run in order. The connecting lines are
          implicit and can&apos;t be removed; reorder by dragging activities, and
          flip vertical/horizontal from the toolbar.
        </div>
      ) : null}
      <div className="relative flex-1">
        <ReactFlowProvider>
          {editable ? (
            <EditableCanvas />
          ) : (
            <ReadOnlyCanvas
              definition={definition}
              statsByActivityId={props.statsByActivityId}
              onActivityClick={props.onActivityClick}
            />
          )}
        </ReactFlowProvider>
      </div>
    </div>
  );
}

function shortTypeName(type: string): string {
  const segs = type.split(".");
  return segs[segs.length - 1] ?? type;
}

// -- Edge helpers ---------------------------------------------------------

/**
 * Look up an edge in `edges`. First by id; if that misses (e.g. the edge was
 * just rehydrated and got a new id) try a quadruple match. Used by both the
 * `+` button splice and the drop-on-edge splice.
 */
function findEdge(edges: Edge[], edgeId: string): Edge | undefined {
  const exact = edges.find((e) => e.id === edgeId);
  if (exact) return exact;
  // Best-effort fallback: parse the stable id format we emit from build-graph
  // (`e-<idx>-<source>:<sp>-><target>:<tp>`) and match by the quadruple.
  const match = /^e-\d+-(.+?):(.+?)->(.+?):(.+?)$/.exec(edgeId);
  if (!match) return undefined;
  const [, source, sp, target, tp] = match;
  return edges.find(
    (e) =>
      e.source === source &&
      e.target === target &&
      (e.sourceHandle ?? "out") === sp &&
      (e.targetHandle ?? "in") === tp,
  );
}

/**
 * Replace `oldEdge` in `edges` with two replacement edges that route through
 * `newNodeId`. Removes the original via `Object.is` reference so we don't
 * trip over a stale id. The replacements preserve the old endpoints' port
 * names and default the new node's outbound port to "Done" — the canonical
 * outcome that ActivityNode emits when a descriptor has no explicit ports.
 */
function spliceEdge(edges: Edge[], oldEdge: Edge, newNodeId: string): Edge[] {
  const remaining = edges.filter((e) => e !== oldEdge && e.id !== oldEdge.id);
  const ts = Date.now();
  const inEdge: Edge = {
    id: `e-splice-in-${oldEdge.source}-${newNodeId}-${ts}`,
    source: oldEdge.source,
    target: newNodeId,
    sourceHandle: oldEdge.sourceHandle ?? undefined,
    targetHandle: undefined,
    type: "smoothstep",
    style: { stroke: "var(--muted-foreground)" },
  };
  const outEdge: Edge = {
    id: `e-splice-out-${newNodeId}-${oldEdge.target}-${ts + 1}`,
    source: newNodeId,
    target: oldEdge.target,
    sourceHandle: "Done",
    targetHandle: oldEdge.targetHandle ?? undefined,
    type: "smoothstep",
    style: { stroke: "var(--muted-foreground)" },
  };
  return [...remaining, inEdge, outEdge];
}

// -- Placement helpers ----------------------------------------------------
//
// React Flow doesn't know the visual size of a node we haven't rendered yet,
// so we fall back to a sensible default that matches the activity card's
// min/max width (220–300px → 240 average) and observed height. These keep
// the inline-insert math consistent regardless of measured dimensions.
const NEW_NODE_DEFAULT_WIDTH = 240;
const NEW_NODE_DEFAULT_HEIGHT = 80;
const INLINE_GAP = 80;

function widthOf(n: { measured?: { width?: number }; width?: number | null }): number {
  return n.measured?.width ?? n.width ?? NEW_NODE_DEFAULT_WIDTH;
}

function heightOf(n: { measured?: { height?: number }; height?: number | null }): number {
  return n.measured?.height ?? n.height ?? NEW_NODE_DEFAULT_HEIGHT;
}

/** Position to the right of `source`, vertically centred to the source's row. */
function rightOf(source: Node<ActivityNodeData>): { x: number; y: number } {
  const w = widthOf(source);
  const h = heightOf(source);
  return {
    x: Math.round(source.position.x + w + INLINE_GAP),
    // Align vertical center of the new node with the source's center so the
    // smoothstep connection draws horizontally instead of stair-stepping.
    y: Math.round(source.position.y + h / 2 - NEW_NODE_DEFAULT_HEIGHT / 2),
  };
}

/** Midpoint placement so the new node visually sits between source and target. */
function midpointBetween(
  source: Node<ActivityNodeData>,
  target: Node<ActivityNodeData>,
): { x: number; y: number } {
  const sw = widthOf(source);
  const sh = heightOf(source);
  const th = heightOf(target);
  const srcRightEdge = source.position.x + sw;
  const tgtLeftEdge = target.position.x;
  const centerX = (srcRightEdge + tgtLeftEdge) / 2;
  const sourceCenterY = source.position.y + sh / 2;
  const targetCenterY = target.position.y + th / 2;
  const centerY = (sourceCenterY + targetCenterY) / 2;
  return {
    x: Math.round(centerX - NEW_NODE_DEFAULT_WIDTH / 2),
    y: Math.round(centerY - NEW_NODE_DEFAULT_HEIGHT / 2),
  };
}

/** Deep-clone an activity tree, generating fresh ids for every nested activity. */
function cloneActivityWithFreshIds(src: ActivityJson): ActivityJson {
  const short = shortTypeName(src.type);
  const newId = `${short.charAt(0).toLowerCase()}${short.slice(1)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const cloned: ActivityJson = JSON.parse(JSON.stringify(src));
  cloned.id = newId;
  if (Array.isArray(cloned.activities)) {
    cloned.activities = cloned.activities.map((c) => cloneActivityWithFreshIds(c));
  }
  return cloned;
}

// Re-export for tests / callers that imported it from this module historically.
export { makeActivity };
