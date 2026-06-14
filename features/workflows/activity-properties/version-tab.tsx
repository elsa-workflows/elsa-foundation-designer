"use client";

import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

/**
 * Activity version pane — read-only descriptor/version info. Mirrors the
 * Blazor `VersionTab` which surfaces the activity type's version (so users
 * can confirm an instance isn't running an outdated descriptor).
 */
export function ActivityVersionTab({
  activity,
  descriptor,
}: {
  activity: ActivityJson;
  descriptor: ActivityDescriptor | null;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Activity version", value: String(activity.version ?? "—") },
    {
      label: "Descriptor version",
      value: descriptor ? String(descriptor.version) : "—",
    },
    {
      label: "Latest available",
      value: descriptor ? String(descriptor.version) : "—",
    },
    {
      label: "Type",
      value: descriptor?.displayName?.trim() || activity.type.split(".").at(-1) || "",
    },
    { label: "Type name", value: activity.type },
  ];

  const isStale =
    descriptor != null &&
    typeof activity.version === "number" &&
    activity.version < descriptor.version;

  return (
    <div className="flex flex-col gap-3">
      {isStale ? (
        <div className="rounded-md border border-amber-400/60 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          This activity is using version <strong>v{activity.version}</strong>{" "}
          but the descriptor is at <strong>v{descriptor!.version}</strong>.
          Re-save the workflow to pick up the latest schema.
        </div>
      ) : null}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground font-medium uppercase tracking-wide">
              {r.label}
            </dt>
            <dd className="font-mono">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
