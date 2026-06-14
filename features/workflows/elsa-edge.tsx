"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

export type Vertex = { x: number; y: number };

/**
 * Operations the custom Elsa edge needs to call on its parent canvas:
 * delete itself, request an "insert activity" picker at a screen position,
 * and update the polyline waypoints (vertices) the user manipulates by
 * double-clicking / dragging the edge body. Lives in a context so we don't
 * have to wire callbacks through every edge.
 */
export type EdgeOps = {
  deleteEdge: (edgeId: string) => void;
  requestInsertActivity: (edgeId: string, clientX: number, clientY: number) => void;
  readOnly: boolean;
  /** Edge currently flagged as the splice target during a palette drag-drop. */
  highlightedEdgeId: string | null;
  /** Replace the waypoints on a single edge. `undefined` clears them. */
  updateEdgeVertices: (edgeId: string, vertices: Vertex[] | undefined) => void;
};

const EdgeOpsContext = createContext<EdgeOps | null>(null);

export function EdgeOpsProvider({
  ops,
  children,
}: {
  ops: EdgeOps;
  children: React.ReactNode;
}) {
  return <EdgeOpsContext.Provider value={ops}>{children}</EdgeOpsContext.Provider>;
}

function useEdgeOps(): EdgeOps {
  const ctx = useContext(EdgeOpsContext);
  if (!ctx) {
    throw new Error("EdgeOpsContext missing — ElsaFlowEdge must render inside EdgeOpsProvider");
  }
  return ctx;
}

/**
 * Custom React Flow edge with hover-revealed + (insert activity) and × (delete)
 * buttons floating at the edge midpoint. Mirrors the Blazor `ElsaEdge.tsx`.
 *
 * Two implementation notes that matter for the buttons to actually work:
 *
 *  1. `EdgeLabelRenderer` portals its children into a wrapper with
 *     `pointer-events: none`. The button wrapper must opt back in with
 *     `pointer-events: auto` (otherwise clicks fall through to the canvas).
 *
 *  2. The SVG `<g>` and the portaled button div sit in different DOM trees,
 *     so moving the cursor from the path to a button briefly leaves both
 *     elements. We bridge that with a short hide-delay: leaving an element
 *     schedules a 150ms hide, entering either element cancels it. The buttons
 *     also share the same enter/leave so they keep themselves alive while
 *     hovered.
 */
/**
 * Build a polyline path through `points` with rounded corners (radius `r`) at
 * each interior vertex. Mirrors Blazor's `polylinePath` helper. When `points`
 * has only the source + target (no waypoints), the result is a straight line
 * `M sx sy L tx ty`. The corner-rounding clamps `r` to half the shorter
 * adjoining segment length so it never over-rounds tight bends.
 */
function polylinePath(points: Vertex[], r = 8): string {
  if (points.length < 2) return "";
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  const segs: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const dxIn = cur.x - prev.x;
    const dyIn = cur.y - prev.y;
    const lenIn = Math.hypot(dxIn, dyIn) || 1;
    const dxOut = next.x - cur.x;
    const dyOut = next.y - cur.y;
    const lenOut = Math.hypot(dxOut, dyOut) || 1;
    const radius = Math.min(r, lenIn / 2, lenOut / 2);
    const enterX = cur.x - (dxIn / lenIn) * radius;
    const enterY = cur.y - (dyIn / lenIn) * radius;
    const exitX = cur.x + (dxOut / lenOut) * radius;
    const exitY = cur.y + (dyOut / lenOut) * radius;
    segs.push(`L ${enterX} ${enterY}`);
    segs.push(`Q ${cur.x} ${cur.y} ${exitX} ${exitY}`);
  }
  const last = points[points.length - 1];
  segs.push(`L ${last.x} ${last.y}`);
  return segs.join(" ");
}

/**
 * Insert a new vertex between the two existing points that are closest to
 * `at`. Returns the next vertex list (full waypoints only — no source / target).
 */
function insertVertex(
  source: Vertex,
  target: Vertex,
  current: Vertex[],
  at: Vertex,
): Vertex[] {
  const points = [source, ...current, target];
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / len2));
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    const d = Math.hypot(px - at.x, py - at.y);
    if (d < bestDist) {
      bestDist = d;
      bestIndex = i;
    }
  }
  // bestIndex is the segment index in the source+waypoints+target list. The
  // vertex slot we insert into is bestIndex (since waypoints are indexed
  // 0..N-1 between source and target).
  const next = current.slice();
  next.splice(bestIndex, 0, { x: Math.round(at.x), y: Math.round(at.y) });
  return next;
}

export function ElsaFlowEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    selected,
    label,
    labelStyle,
    labelBgStyle,
    data,
  } = props;

  const ops = useEdgeOps();
  const rf = useReactFlow();
  const [hovered, setHovered] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSpliceTarget = ops.highlightedEdgeId === id;

  const isImplicit =
    (data as { implicit?: boolean } | undefined)?.implicit === true;
  const persistedVertices =
    (data as { vertices?: Vertex[] } | undefined)?.vertices ?? [];
  const persistedKey = JSON.stringify(persistedVertices);
  // Local mirror of the vertex list so dragging is silky — we commit to the
  // store via `updateEdgeVertices` on pointer up.
  const [vertices, setVertices] = useState<Vertex[]>(persistedVertices);
  // When the persisted list changes (after a commit, undo, or rehydrate),
  // sync local state. Comparison by stringified key avoids ref reads during
  // render and keeps the effect dep stable.
  useEffect(() => {
    setVertices((curr) =>
      JSON.stringify(curr) === persistedKey ? curr : persistedVertices,
    );
    // We deliberately depend on the serialised key, not the array identity,
    // since each render produces a new `persistedVertices` array literal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistedKey]);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  const enter = useCallback(() => {
    cancelHide();
    setHovered(true);
  }, [cancelHide]);

  const leave = useCallback(() => {
    cancelHide();
    hideTimer.current = setTimeout(() => setHovered(false), 150);
  }, [cancelHide]);

  // Clean up the hide timer on unmount so we never call setState after teardown.
  useEffect(() => cancelHide, [cancelHide]);

  // Path: when the user has placed vertices, render a polyline through them.
  // Otherwise fall back to React Flow's smoothstep.
  const sourcePt: Vertex = { x: sourceX, y: sourceY };
  const targetPt: Vertex = { x: targetX, y: targetY };
  let path = "";
  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2;
  if (vertices.length > 0) {
    path = polylinePath([sourcePt, ...vertices, targetPt]);
    // Place buttons near the middle of the polyline by averaging the central
    // vertex (or mid-segment if even count).
    const mid =
      vertices.length === 1
        ? vertices[0]
        : vertices[Math.floor(vertices.length / 2)];
    labelX = mid.x;
    labelY = mid.y;
  } else {
    const [smoothPath, lx, ly] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
    path = smoothPath;
    labelX = lx;
    labelY = ly;
  }

  const baseStyle: React.CSSProperties = isSpliceTarget
    ? { ...(style ?? {}), stroke: "#0ea5e9", strokeWidth: 3 }
    : (style ?? {});

  const onInsertClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    ops.requestInsertActivity(id, e.clientX, e.clientY);
  };

  const onDeleteClick = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    ops.deleteEdge(id);
  };

  /** Add a vertex when the user double-clicks the edge body. */
  const onDoubleClick = (e: ReactMouseEvent<SVGPathElement>) => {
    if (ops.readOnly || isImplicit) return;
    e.stopPropagation();
    const at = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const next = insertVertex(sourcePt, targetPt, vertices, at);
    setVertices(next);
    ops.updateEdgeVertices(id, next);
  };

  /** Begin dragging a single vertex. Listens on window for move + up. */
  const startVertexDrag = (idx: number, e: ReactMouseEvent<SVGCircleElement>) => {
    if (ops.readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const onMove = (mv: MouseEvent) => {
      const at = rf.screenToFlowPosition({ x: mv.clientX, y: mv.clientY });
      setVertices((prev) => {
        const next = prev.slice();
        next[idx] = { x: Math.round(at.x), y: Math.round(at.y) };
        return next;
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      // Commit the final vertex list to the store; React state is already
      // current via the moves above.
      setVertices((curr) => {
        ops.updateEdgeVertices(id, curr);
        return curr;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  /** Right-click a vertex to remove it. */
  const onVertexContextMenu = (
    idx: number,
    e: ReactMouseEvent<SVGCircleElement>,
  ) => {
    if (ops.readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const next = vertices.filter((_, i) => i !== idx);
    setVertices(next);
    ops.updateEdgeVertices(id, next.length === 0 ? undefined : next);
  };

  const showButtons = hovered && !ops.readOnly;
  const showVertexHandles = (hovered || selected) && !ops.readOnly && !isImplicit;

  return (
    <>
      <g
        onMouseEnter={enter}
        onMouseLeave={leave}
        className={selected ? "selected" : undefined}
      >
        <BaseEdge id={id} path={path} style={baseStyle} markerEnd={markerEnd} />
        {/* Wide invisible hit area for reliable hover + dbl-click detection. */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={24}
          style={{ cursor: ops.readOnly ? "default" : "pointer" }}
          onDoubleClick={onDoubleClick}
        />
        {/* Vertex handles — small dots the user can drag or right-click. */}
        {showVertexHandles
          ? vertices.map((v, i) => (
              <circle
                key={`${id}-v-${i}`}
                cx={v.x}
                cy={v.y}
                r={5}
                fill="var(--background)"
                stroke="var(--primary)"
                strokeWidth={1.5}
                style={{ cursor: "grab" }}
                onMouseDown={(e) => startVertexDrag(i, e)}
                onContextMenu={(e) => onVertexContextMenu(i, e)}
              />
            ))
          : null}
      </g>

      <EdgeLabelRenderer>
        {label ? (
          <div
            className="bg-background text-muted-foreground pointer-events-none absolute rounded-sm border px-1 py-0.5 text-2xs"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 18}px)`,
              ...(labelStyle ?? {}),
              ...(labelBgStyle ?? {}),
            }}
          >
            {label}
          </div>
        ) : null}

        {!ops.readOnly ? (
          <div
            onMouseEnter={enter}
            onMouseLeave={leave}
            className="nodrag nopan absolute flex items-center gap-1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: showButtons ? "auto" : "none",
              opacity: showButtons ? 1 : 0,
              transition: "opacity 100ms",
            }}
          >
            {isImplicit ? null : (
              <button
                type="button"
                className="bg-card text-foreground hover:bg-sky-500 hover:text-white inline-flex size-5 items-center justify-center rounded-full border shadow-sm transition-colors"
                title="Insert activity"
                aria-label="Insert activity"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onInsertClick}
              >
                <span className="text-xs leading-none">+</span>
              </button>
            )}
            {isImplicit ? null : (
              <button
                type="button"
                className="bg-card text-foreground hover:bg-rose-500 hover:text-white inline-flex size-5 items-center justify-center rounded-full border shadow-sm transition-colors"
                title="Remove edge"
                aria-label="Remove edge"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={onDeleteClick}
              >
                <span className="text-xs leading-none">×</span>
              </button>
            )}
          </div>
        ) : null}
      </EdgeLabelRenderer>
    </>
  );
}
