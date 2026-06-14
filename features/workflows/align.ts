import type { Node } from "@xyflow/react";

export type AlignAxis = "left" | "right" | "top" | "bottom" | "center-x" | "center-y";

/** Default size we assume when a node hasn't been measured yet. */
const FALLBACK_WIDTH = 220;
const FALLBACK_HEIGHT = 80;

function widthOf<T extends Record<string, unknown>>(n: Node<T>): number {
  return n.measured?.width ?? n.width ?? FALLBACK_WIDTH;
}

function heightOf<T extends Record<string, unknown>>(n: Node<T>): number {
  return n.measured?.height ?? n.height ?? FALLBACK_HEIGHT;
}

/**
 * Align the selected subset of `nodes` along the requested axis. The alignment
 * target is the bounding-box edge / center of the selection. Returns a new
 * array with the moved nodes; unselected nodes pass through unchanged.
 */
export function alignSelected<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  axis: AlignAxis,
): Node<T>[] {
  const selected = nodes.filter((n) => n.selected);
  if (selected.length < 2) return nodes;

  const positions = selected.map((n) => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    w: widthOf(n),
    h: heightOf(n),
  }));

  let setX: ((p: (typeof positions)[number]) => number) | null = null;
  let setY: ((p: (typeof positions)[number]) => number) | null = null;

  switch (axis) {
    case "left": {
      const target = Math.min(...positions.map((p) => p.x));
      setX = () => target;
      break;
    }
    case "right": {
      const target = Math.max(...positions.map((p) => p.x + p.w));
      setX = (p) => target - p.w;
      break;
    }
    case "top": {
      const target = Math.min(...positions.map((p) => p.y));
      setY = () => target;
      break;
    }
    case "bottom": {
      const target = Math.max(...positions.map((p) => p.y + p.h));
      setY = (p) => target - p.h;
      break;
    }
    case "center-x": {
      const target =
        positions.reduce((acc, p) => acc + p.x + p.w / 2, 0) / positions.length;
      setX = (p) => target - p.w / 2;
      break;
    }
    case "center-y": {
      const target =
        positions.reduce((acc, p) => acc + p.y + p.h / 2, 0) / positions.length;
      setY = (p) => target - p.h / 2;
      break;
    }
  }

  const byId = new Map(positions.map((p) => [p.id, p]));
  return nodes.map((n) => {
    if (!n.selected) return n;
    const p = byId.get(n.id);
    if (!p) return n;
    const x = setX ? Math.round(setX(p)) : p.x;
    const y = setY ? Math.round(setY(p)) : p.y;
    if (x === p.x && y === p.y) return n;
    return { ...n, position: { x, y } };
  });
}
