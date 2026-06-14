import { getEmbeddedChildren, setEmbeddedChildren } from "@/features/workflows/embedded-ports";
import type { ActivityJson } from "@/lib/api/types";

/**
 * Build a hierarchical `nodeId` like Elsa's runtime: parent path + `:` + activity id.
 * Returns just the activity id when no parent path is present.
 */
export function buildNodeId(parentNodeId: string, activityId: string): string {
  return parentNodeId ? `${parentNodeId}:${activityId}` : activityId;
}

const PORT_KEY_RE = /[A-Z][A-Za-z0-9]*/;

/**
 * Walks an activity tree and rewrites `nodeId` on every node so the chain
 * always rooted at `${workflowName}:${root.id}`. Both direct `activities[]`
 * collections and embedded-port children are visited; per-type wrappers
 * (e.g. Switch cases) survive because reads/writes go through
 * `embedded-ports.ts`.
 *
 * Idempotent. Cheap (O(n)). Designed to run once per save so we don't have
 * to track `nodeId` invariants through every individual mutation.
 */
export function recomputeNodeIds(
  root: ActivityJson,
  workflowName: string,
): ActivityJson {
  const rootNodeId = buildNodeId(workflowName || "Workflow1", root.id);
  return walk(root, rootNodeId);
}

function walk(node: ActivityJson, nodeId: string): ActivityJson {
  let next: ActivityJson = node.nodeId === nodeId ? node : { ...node, nodeId };
  let changed = next !== node;

  // 1) Recurse into the universal `activities[]` collection.
  if (Array.isArray(next.activities)) {
    const updated = next.activities.map((child) => walk(child, buildNodeId(nodeId, child.id)));
    if (updated.some((u, i) => u !== next.activities![i])) {
      next = { ...next, activities: updated };
      changed = true;
    }
  }

  // 2) Recurse into every embedded-port child. We can't enumerate ports
  // without descriptors, so we scan keys that look like camelCase property
  // names whose values are activities, plus the Switch `cases[].activity`
  // wrapper. The setter round-trips so per-type semantics are preserved.
  for (const key of Object.keys(next)) {
    if (
      key === "id" ||
      key === "nodeId" ||
      key === "name" ||
      key === "type" ||
      key === "version" ||
      key === "metadata" ||
      key === "customProperties" ||
      key === "activities" ||
      key === "connections" ||
      key === "variables" ||
      key === "start"
    )
      continue;
    const value = (next as Record<string, unknown>)[key];
    if (looksLikeActivity(value)) {
      const portName = portNameFromKey(key);
      if (!portName) continue;
      const updatedChild = walk(value, buildNodeId(nodeId, value.id));
      if (updatedChild !== value) {
        next = setEmbeddedChildren(next, { name: portName }, [updatedChild]);
        changed = true;
      }
    } else if (key === "cases" && Array.isArray(value)) {
      // Switch's wrapped cases: `{ label, condition, activity }`.
      const updatedCases = value.map((c) => {
        if (!c || typeof c !== "object") return c;
        const wrapper = c as Record<string, unknown>;
        const inner = wrapper.activity;
        if (!looksLikeActivity(inner)) return c;
        const updated = walk(inner, buildNodeId(nodeId, inner.id));
        return updated === inner ? c : { ...wrapper, activity: updated };
      });
      if (updatedCases.some((u, i) => u !== value[i])) {
        next = { ...next, cases: updatedCases } as ActivityJson;
        changed = true;
      }
    }
  }

  return changed ? next : node;
}

function portNameFromKey(key: string): string | null {
  // The embedded-port providers camelCase the port name (`UnmatchedStatusCode`
  // → `unmatchedStatusCode`). Reverse: capitalize the first letter. Reject
  // keys that don't follow the typical port naming pattern so we don't
  // accidentally treat unrelated activity props as ports.
  if (!key || key[0] !== key[0].toLowerCase()) return null;
  const pascal = key.charAt(0).toUpperCase() + key.slice(1);
  return PORT_KEY_RE.test(pascal) ? pascal : null;
}

function looksLikeActivity(x: unknown): x is ActivityJson {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { type?: unknown }).type === "string"
  );
}

// Silence unused-import warnings if tree-shaking opts in.
void getEmbeddedChildren;
