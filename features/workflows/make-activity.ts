import { generateNextName } from "@/features/workflows/activity-name-generator";
import { buildNodeId } from "@/features/workflows/node-id";
import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

/** Strip the namespace, return the last segment. */
function shortType(typeName: string): string {
  const segs = typeName.split(".");
  return segs[segs.length - 1] ?? typeName;
}

/**
 * Build a fresh `ActivityJson` for `typeName`. Matches the data shape the
 * Blazor designer writes:
 *   - random short `id`
 *   - hierarchical `nodeId` from `parentNodeId`
 *   - auto-generated `name` (e.g. `Flowchart1`, `HttpEndpoint2`)
 *   - descriptor-driven `version`
 *   - `metadata.displayText` + optional designer position
 *   - empty `customProperties` (then overlaid by descriptor.constructionProperties)
 *   - the descriptor's `constructionProperties` spread at root level
 *
 * `position` may be `null` for embedded children that shouldn't carry a
 * canvas position. `parentNodeId` defaults to an empty string when the
 * caller doesn't know the parent path (the recompute pass will fix it on
 * the next save), but call sites should pass it whenever possible so the
 * shape is parity-correct without needing a recompute.
 */
export function makeActivity(
  typeName: string,
  descriptor: ActivityDescriptor | undefined,
  position: { x: number; y: number } | null,
  parentNodeId: string = "",
  workflowRoot: ActivityJson | null = null,
): ActivityJson {
  const short = shortType(typeName);
  const id = `${short.charAt(0).toLowerCase()}${short.slice(1)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const designer = position
    ? { position: { x: Math.round(position.x), y: Math.round(position.y) } }
    : undefined;
  const name = generateNextName(workflowRoot, descriptor ?? null, typeName);
  return {
    id,
    nodeId: buildNodeId(parentNodeId, id),
    name,
    type: typeName,
    version: descriptor?.version,
    customProperties: {},
    metadata: {
      displayText: descriptor?.displayName ?? short,
      ...(designer ? { designer } : {}),
    },
    ...(descriptor?.constructionProperties ?? {}),
  };
}
