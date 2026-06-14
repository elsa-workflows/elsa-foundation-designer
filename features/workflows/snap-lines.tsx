"use client";

import { ViewportPortal, type Node } from "@xyflow/react";

export type SnapLines = {
  /** x positions in flow coordinates where vertical guide lines should render. */
  vertical: number[];
  /** y positions in flow coordinates where horizontal guide lines should render. */
  horizontal: number[];
  /** Extents covering both the dragged node and every aligned reference node. */
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
};

const FALLBACK_WIDTH = 220;
const FALLBACK_HEIGHT = 80;
const THRESHOLD = 6;

function widthOf<T extends Record<string, unknown>>(n: Node<T>): number {
  return n.measured?.width ?? n.width ?? FALLBACK_WIDTH;
}

function heightOf<T extends Record<string, unknown>>(n: Node<T>): number {
  return n.measured?.height ?? n.height ?? FALLBACK_HEIGHT;
}

/**
 * Compute alignment guides for `dragged` versus every node in `others`.
 * Matches Blazor's `snap-lines` ClientLib helper: emit a vertical line when
 * the dragged node's left / center-x / right is within THRESHOLD of any
 * other node's same edges, and analogously for horizontal.
 *
 * Returns `null` when there's nothing to align with.
 */
export function computeSnapLines<T extends Record<string, unknown>>(
  dragged: Node<T> | undefined,
  others: Node<T>[],
): SnapLines | null {
  if (!dragged) return null;

  const dx = dragged.position.x;
  const dy = dragged.position.y;
  const dw = widthOf(dragged);
  const dh = heightOf(dragged);

  const dV = [dx, dx + dw / 2, dx + dw];
  const dH = [dy, dy + dh / 2, dy + dh];

  const vertical = new Set<number>();
  const horizontal = new Set<number>();
  let minX = dx;
  let maxX = dx + dw;
  let minY = dy;
  let maxY = dy + dh;

  for (const o of others) {
    if (o.id === dragged.id) continue;
    const ox = o.position.x;
    const oy = o.position.y;
    const ow = widthOf(o);
    const oh = heightOf(o);

    const oV = [ox, ox + ow / 2, ox + ow];
    const oH = [oy, oy + oh / 2, oy + oh];

    for (const dv of dV) {
      for (const ov of oV) {
        if (Math.abs(dv - ov) <= THRESHOLD) {
          vertical.add(ov);
          minY = Math.min(minY, oy);
          maxY = Math.max(maxY, oy + oh);
        }
      }
    }
    for (const dh2 of dH) {
      for (const oh2 of oH) {
        if (Math.abs(dh2 - oh2) <= THRESHOLD) {
          horizontal.add(oh2);
          minX = Math.min(minX, ox);
          maxX = Math.max(maxX, ox + ow);
        }
      }
    }
  }

  if (vertical.size === 0 && horizontal.size === 0) return null;
  return {
    vertical: Array.from(vertical),
    horizontal: Array.from(horizontal),
    bounds: { minX, maxX, minY, maxY },
  };
}

/**
 * SVG overlay that draws the computed snap guides. Lives inside a
 * `ViewportPortal` so positions are interpreted as flow coordinates and the
 * lines pan/zoom with the canvas.
 */
export function SnapLinesOverlay({ lines }: { lines: SnapLines | null }) {
  if (!lines) return null;
  const pad = 32;
  return (
    <ViewportPortal>
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 1000,
        }}
        width={1}
        height={1}
        aria-hidden
      >
        {lines.vertical.map((x, i) => (
          <line
            key={`v-${i}-${x}`}
            x1={x}
            x2={x}
            y1={lines.bounds.minY - pad}
            y2={lines.bounds.maxY + pad}
            stroke="#0ea5e9"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}
        {lines.horizontal.map((y, i) => (
          <line
            key={`h-${i}-${y}`}
            x1={lines.bounds.minX - pad}
            x2={lines.bounds.maxX + pad}
            y1={y}
            y2={y}
            stroke="#0ea5e9"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}
      </svg>
    </ViewportPortal>
  );
}
