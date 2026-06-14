"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";

import type { StateMachineEdgeData } from "@/features/workflows/build-state-machine-graph";

/** Pixel spacing between parallel transitions sharing the same (from, to) pair. */
const PARALLEL_SPACING = 26;

/**
 * Smoothstep edge for state-machine transitions when there's only one between
 * the pair; quadratic-bezier-with-perpendicular-offset when there are several
 * (so duplicates don't render on top of each other). Renders the transition
 * label (displayName || name) at the midpoint plus tiny chips indicating
 * whether the transition carries a condition / trigger / action.
 */
export function StateTransitionEdge(props: EdgeProps) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    selected,
    data,
  } = props;

  const d = data as StateMachineEdgeData | undefined;
  const total = d?.parallelTotal ?? 1;
  const idx = d?.parallelIndex ?? 0;

  let path: string;
  let labelX: number;
  let labelY: number;
  if (total <= 1) {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  } else {
    // Spread parallel edges symmetrically around the straight line between
    // source and target by offsetting the control point perpendicular to it.
    // Slot positions:  -((n-1)/2) … +((n-1)/2)  scaled by spacing.
    const slot = idx - (total - 1) / 2;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const len = Math.hypot(dx, dy) || 1;
    const px = -dy / len; // perpendicular unit vector
    const py = dx / len;
    const offset = slot * PARALLEL_SPACING;
    const midX = (sourceX + targetX) / 2 + px * offset;
    const midY = (sourceY + targetY) / 2 + py * offset;
    // Quadratic Bezier through the offset midpoint. The Bezier sits above
    // the chord proportional to the offset so the curve flexes outward.
    path = `M ${sourceX} ${sourceY} Q ${midX} ${midY} ${targetX} ${targetY}`;
    // Approximate the label position at the curve's peak — for a quadratic
    // Bezier at t=0.5 that's (S + 2*M + T) / 4.
    labelX = (sourceX + 2 * midX + targetX) / 4;
    labelY = (sourceY + 2 * midY + targetY) / 4;
  }

  const label = d?.displayName?.trim() || d?.name?.trim() || "";
  const chips: string[] = [];
  if (d?.hasCondition) chips.push("if");
  if (d?.hasTrigger) chips.push("on");
  if (d?.hasAction) chips.push("do");

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={{ ...style, strokeWidth: selected ? 1.75 : 1.25 }}
      />
      {label || chips.length > 0 ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="bg-background text-foreground border-border flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs shadow-sm"
          >
            {label ? <span>{label}</span> : null}
            {chips.map((c) => (
              <span
                key={c}
                className="bg-muted text-muted-foreground rounded px-1 text-2xs font-medium uppercase tracking-wide"
              >
                {c}
              </span>
            ))}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
