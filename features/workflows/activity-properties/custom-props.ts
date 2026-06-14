import type { ActivityJson } from "@/lib/api/types";

/**
 * Read/write helpers for nested values under `activity.customProperties` —
 * the canonical home for advanced activity fields (commitStrategyName,
 * resilienceStrategy, …). Matches the Blazor `ActivityExtensions` accessors.
 */

export function getCustomProperty<T = unknown>(
  activity: ActivityJson,
  key: string,
): T | undefined {
  const bag = (activity as Record<string, unknown>).customProperties;
  if (!bag || typeof bag !== "object") return undefined;
  return (bag as Record<string, unknown>)[key] as T | undefined;
}

export function setCustomProperty(
  activity: ActivityJson,
  key: string,
  value: unknown,
): ActivityJson {
  const prev = (activity as Record<string, unknown>).customProperties;
  const bag = (typeof prev === "object" && prev ? { ...prev } : {}) as Record<string, unknown>;
  if (value === undefined || value === null || value === "") {
    delete bag[key];
  } else {
    bag[key] = value;
  }
  return { ...activity, customProperties: bag } as ActivityJson;
}

export function getMetadataProperty<T = unknown>(
  activity: ActivityJson,
  key: string,
): T | undefined {
  const bag = activity.metadata as Record<string, unknown> | undefined;
  if (!bag) return undefined;
  return bag[key] as T | undefined;
}

export function setMetadataProperty(
  activity: ActivityJson,
  key: string,
  value: unknown,
): ActivityJson {
  const prev = activity.metadata;
  const bag = (prev ? { ...prev } : {}) as Record<string, unknown>;
  if (value === undefined || value === null || value === "") {
    delete bag[key];
  } else {
    bag[key] = value;
  }
  return { ...activity, metadata: bag };
}
