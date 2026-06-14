import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

/**
 * Compute the next unused `Name<N>` for `descriptor` inside `workflowRoot`.
 * Mirrors Blazor's `ActivityNameGenerator.GenerateNextName` — base name comes
 * from the descriptor's short type name (`Elsa.HttpEndpoint` → `HttpEndpoint`),
 * suffix is the smallest positive integer that doesn't collide with an
 * existing activity name in the tree (including embedded ports).
 */
export function generateNextName(
  workflowRoot: ActivityJson | null | undefined,
  descriptor: Pick<ActivityDescriptor, "typeName" | "name" | "displayName"> | null | undefined,
  fallbackTypeName?: string,
): string {
  const base = baseName(descriptor, fallbackTypeName);
  if (!workflowRoot) return `${base}1`;

  const used = new Set<number>();
  walk(workflowRoot, (a) => {
    const name = typeof a.name === "string" ? a.name : null;
    if (!name) return;
    if (!name.startsWith(base)) return;
    const tail = name.slice(base.length);
    if (!/^\d+$/.test(tail)) return;
    used.add(parseInt(tail, 10));
  });

  let n = 1;
  while (used.has(n)) n += 1;
  return `${base}${n}`;
}

function baseName(
  descriptor: Pick<ActivityDescriptor, "typeName" | "name" | "displayName"> | null | undefined,
  fallbackTypeName?: string,
): string {
  // Prefer descriptor.name (already a short identifier); fall back to the
  // short segment of typeName, then to the displayName with whitespace
  // stripped. Last-ditch: the bare fallback type name.
  if (descriptor?.name && /^[A-Za-z][A-Za-z0-9]*$/.test(descriptor.name)) return descriptor.name;
  const typeName = descriptor?.typeName ?? fallbackTypeName ?? "Activity";
  const short = typeName.split(".").pop() ?? typeName;
  if (/^[A-Za-z][A-Za-z0-9]*$/.test(short)) return short;
  const display = (descriptor?.displayName ?? short).replace(/\s+/g, "");
  return display || "Activity";
}

function walk(node: ActivityJson, visit: (a: ActivityJson) => void) {
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (
      key === "id" ||
      key === "nodeId" ||
      key === "name" ||
      key === "type" ||
      key === "version" ||
      key === "metadata" ||
      key === "customProperties" ||
      key === "connections" ||
      key === "variables" ||
      key === "start"
    )
      continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (looksLikeActivity(item)) walk(item, visit);
        else if (key === "cases" && item && typeof item === "object") {
          const inner = (item as Record<string, unknown>).activity;
          if (looksLikeActivity(inner)) walk(inner, visit);
        }
      }
    } else if (looksLikeActivity(value)) {
      walk(value, visit);
    }
  }
}

function looksLikeActivity(x: unknown): x is ActivityJson {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { type?: unknown }).type === "string"
  );
}
