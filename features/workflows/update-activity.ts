import type { ActivityJson } from "@/lib/api/types";

/**
 * Walks the activity tree and returns a new tree with the activity matching
 * `id` transformed by `mutator`. Walks both `activities[]` and every
 * activity-shaped field (embedded ports like `then` / `else` / `body` /
 * `default` / `cases[].activity`). Returns the original tree unchanged if
 * nothing matches.
 */
export function updateActivity(
  root: ActivityJson,
  id: string,
  mutator: (a: ActivityJson) => ActivityJson,
): ActivityJson {
  if (root.id === id) return mutator(root);
  let changed = false;
  const next: Record<string, unknown> = { ...root };
  for (const [key, value] of Object.entries(root)) {
    if (key === "metadata") continue;
    if (Array.isArray(value)) {
      let arrayChanged = false;
      const mappedArr = value.map((item) => {
        if (looksLikeActivity(item)) {
          const updated = updateActivity(item, id, mutator);
          if (updated !== item) arrayChanged = true;
          return updated;
        }
        return item;
      });
      if (arrayChanged) {
        next[key] = mappedArr;
        changed = true;
      }
    } else if (looksLikeActivity(value)) {
      const updated = updateActivity(value, id, mutator);
      if (updated !== value) {
        next[key] = updated;
        changed = true;
      }
    }
  }
  return changed ? (next as ActivityJson) : root;
}

function looksLikeActivity(x: unknown): x is ActivityJson {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { type?: unknown }).type === "string"
  );
}

/**
 * Removes an activity from a Flowchart-style root, along with any connections
 * touching it.
 */
export function removeActivity(root: ActivityJson, id: string): ActivityJson {
  const activities = (root.activities ?? []).filter((a) => a.id !== id);
  const connections = (root.connections ?? []).filter(
    (c) => c.source.activity !== id && c.target.activity !== id,
  );
  return { ...root, activities, connections };
}

/** Appends an activity at the top level of a flowchart. */
export function addActivity(root: ActivityJson, activity: ActivityJson): ActivityJson {
  return { ...root, activities: [...(root.activities ?? []), activity] };
}
