"use client";

import { format, formatDistanceStrict } from "date-fns";
import { Loader2, MousePointerSquareDashed } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { useEditorStore } from "@/features/workflows/editor-store";
import { useActivityExecutionSummaries } from "@/lib/api/elsa";
import type { ActivityStatus } from "@/lib/api/types";

type Props = {
  instanceId: string;
  /** Called when the user clicks an execution row — opens the details sheet. */
  onSelect?: (recordId: string) => void;
  /** When set, highlight the row whose execution-record id matches. */
  selectedRecordId?: string | null;
};

/**
 * Per-activity execution table. Mirrors the Blazor
 * `ActivityExecutionsTab.razor`. Reads the currently-selected activity from
 * the editor store (driven by canvas clicks and journal selection) and shows
 * every execution record of that activity for the current instance.
 *
 * Filtering is client-side against the cached summaries to avoid an extra
 * request — the journal already hydrates `useActivityExecutionSummaries` for
 * canvas badges.
 */
export function ActivityExecutionsPanel({
  instanceId,
  onSelect,
  selectedRecordId,
}: Props) {
  const selectedActivityId = useEditorStore((s) => s.selectedActivityId);
  const q = useActivityExecutionSummaries(instanceId, { refetchInterval: 5000 });

  const rows = useMemo(() => {
    if (!selectedActivityId) return [];
    return (q.data ?? [])
      .filter((s) => s.activityId === selectedActivityId)
      .sort((a, b) => +new Date(a.startedAt) - +new Date(b.startedAt));
  }, [q.data, selectedActivityId]);

  if (!selectedActivityId) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MousePointerSquareDashed className="size-5 opacity-50" />
        <p className="max-w-[28ch] text-xs leading-relaxed">
          Select an activity on the canvas to see every execution recorded for
          this instance.
        </p>
      </div>
    );
  }

  if (q.isPending) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-xs">
        No executions yet for the selected activity.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-3 py-1.5 text-xs">
        <span className="text-muted-foreground uppercase tracking-wide text-[10px]">
          Activity
        </span>{" "}
        <span className="font-mono">{selectedActivityId}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left font-medium">#</th>
              <th className="px-2 py-1 text-left font-medium">Started</th>
              <th className="px-2 py-1 text-left font-medium">Completed</th>
              <th className="px-2 py-1 text-left font-medium">Duration</th>
              <th className="px-2 py-1 text-left font-medium">Status</th>
              <th className="px-2 py-1 text-left font-medium">Bookmarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isSelected = selectedRecordId === r.id;
              return (
                <tr
                  key={r.id}
                  onClick={() => onSelect?.(r.id)}
                  className={[
                    "cursor-pointer border-t transition-colors",
                    isSelected ? "bg-sky-500/10" : "hover:bg-muted/40",
                  ].join(" ")}
                >
                  <td className="px-2 py-1 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-1 whitespace-nowrap font-mono text-[10.5px]">
                    {format(new Date(r.startedAt), "HH:mm:ss")}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap font-mono text-[10.5px]">
                    {r.completedAt ? format(new Date(r.completedAt), "HH:mm:ss") : "—"}
                  </td>
                  <td className="px-2 py-1 whitespace-nowrap font-mono text-[10.5px]">
                    {r.completedAt
                      ? formatDistanceStrict(
                          new Date(r.startedAt),
                          new Date(r.completedAt),
                        )
                      : "—"}
                  </td>
                  <td className="px-2 py-1">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-2 py-1">{r.hasBookmarks ? "yes" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ActivityStatus }) {
  const tone =
    status === "Completed"
      ? "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "Faulted"
        ? "border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-300"
        : status === "Running"
          ? "border-sky-600 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          : status === "Cancelled" || status === "Canceled"
            ? "border-amber-600 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            : "border-muted-foreground/40 bg-muted/30 text-muted-foreground";
  return (
    <Badge variant="outline" className={`font-normal ${tone}`}>
      {status}
    </Badge>
  );
}
