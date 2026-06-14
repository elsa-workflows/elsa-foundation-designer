import { getSequenceOrientation } from "@/features/workflows/build-graph";
import type { ActivityJson } from "@/lib/api/types";

/**
 * Pack a Sequence root's children along the chosen axis (vertical column or
 * horizontal row). Ordering is preserved (no sort) — Sequence ordering is
 * derived from the `activities[]` array index, and re-sorting here would
 * defeat the user's drag-to-reorder.
 *
 * Used by the toolbar's Auto-layout button. Non-Sequence roots are returned
 * unchanged.
 */
export function layoutRootSequence(root: ActivityJson): ActivityJson {
  if (!Array.isArray(root.activities)) return root;

  const orientation = getSequenceOrientation(root);
  const ROW_H = 140;
  const COL_W = 280;

  const activities = root.activities.map((a, i) => {
    const position =
      orientation === "horizontal"
        ? { x: i * COL_W, y: 0 }
        : { x: 0, y: i * ROW_H };
    return {
      ...a,
      metadata: {
        ...(a.metadata ?? {}),
        designer: {
          ...((a.metadata?.designer as Record<string, unknown> | undefined) ?? {}),
          position,
        },
      },
    };
  });
  return { ...root, activities };
}
