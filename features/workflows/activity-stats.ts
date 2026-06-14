import {
  Hourglass,
  Play,
  type LucideIcon,
} from "lucide-react";

import type { ActivityExecutionRecordSummary } from "@/lib/api/types";

/**
 * Per-activity execution counters surfaced on top of the canvas node.
 * Mirrors Blazor `Elsa.Studio.Workflows.Designer.Models.ActivityStats`.
 */
export type ActivityStats = {
  started: number;
  completed: number;
  uncompleted: number;
  faulted: boolean;
  blocked: boolean;
  /** Free-form metadata bag — currently used to surface "HasRetryAttempts". */
  metadata?: Record<string, unknown>;
};

export type BadgeTone = "default" | "success" | "info" | "warning" | "error";

export type BadgeState = {
  tone: BadgeTone;
  /** What number to render inside the chip; `null` means show the icon only. */
  content: string | null;
  /** Optional icon overlaid when there's no count to display. */
  icon?: LucideIcon;
};

/**
 * Compute the badge state for an activity. Matches the Blazor V2 wrapper's
 * priority order (`Components/ActivityWrappers/V2/ActivityWrapper.razor:18-21`):
 *   Faulted > Blocked > Uncompleted > Completed > none.
 */
export function badgeStateFromStats(stats: ActivityStats | undefined): BadgeState | null {
  if (!stats) return null;
  if (stats.faulted) {
    return { tone: "error", content: String(stats.started) };
  }
  if (stats.blocked) {
    return {
      tone: "warning",
      content: stats.started > 0 ? String(stats.started) : null,
      icon: stats.started === 0 ? Hourglass : undefined,
    };
  }
  if (stats.uncompleted > stats.completed) {
    return {
      tone: "info",
      content: stats.completed > 0 ? String(stats.completed) : null,
      icon: stats.completed === 0 ? Play : undefined,
    };
  }
  if (stats.completed > 0) {
    return { tone: "success", content: String(stats.completed) };
  }
  return null;
}

/** Tailwind class fragments per badge tone. */
export const TONE_CLASSES: Record<BadgeTone, string> = {
  default: "bg-muted text-muted-foreground border-border",
  success: "bg-emerald-500 text-white border-emerald-600",
  info: "bg-sky-500 text-white border-sky-600",
  warning: "bg-amber-500 text-white border-amber-600",
  error: "bg-rose-500 text-white border-rose-600",
};

/** Read `metadata.HasRetryAttempts` (case-insensitive) — same key as the V2 wrapper. */
export function hasRetryAttempts(stats: ActivityStats | undefined): boolean {
  if (!stats?.metadata) return false;
  for (const [k, v] of Object.entries(stats.metadata)) {
    if (k.toLowerCase() === "hasretryattempts" && v === true) return true;
  }
  return false;
}

/**
 * Aggregate raw activity-execution summaries into per-activity stats keyed by
 * `activityId`. Mirrors Blazor's `ActivityExecutionRecord → ActivityStats`
 * rollup (Started / Completed / Uncompleted / Faulted / Blocked).
 */
export function aggregateStatsByActivityId(
  summaries: readonly ActivityExecutionRecordSummary[],
): Record<string, ActivityStats> {
  const map = new Map<string, ActivityStats & { metadata: Record<string, unknown> }>();
  for (const r of summaries) {
    const k = r.activityId;
    let s = map.get(k);
    if (!s) {
      s = {
        started: 0,
        completed: 0,
        uncompleted: 0,
        faulted: false,
        blocked: false,
        metadata: {},
      };
      map.set(k, s);
    }
    s.started += 1;
    if (r.status === "Completed") s.completed += 1;
    if (r.status === "Faulted") s.faulted = true;
    if (r.hasBookmarks) s.blocked = true;
    // Surface retry-attempt metadata for the amber dot indicator.
    if (r.metadata) {
      for (const [mk, mv] of Object.entries(r.metadata)) {
        if (mk.toLowerCase() === "hasretryattempts" && mv === true) {
          s.metadata.HasRetryAttempts = true;
        }
      }
    }
  }
  for (const s of map.values()) {
    s.uncompleted = Math.max(0, s.started - s.completed);
  }
  return Object.fromEntries(map);
}
