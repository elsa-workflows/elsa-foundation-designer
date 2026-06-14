"use client";

import { format, formatDistanceStrict } from "date-fns";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock,
  Hourglass,
  Loader2,
  Pause,
  Play,
  TimerReset,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/features/instances/copy-button";
import { displayFor } from "@/features/workflows/activity-display";
import {
  useActivityDescriptors,
  useActivityExecutionSummaries,
  useWorkflowExecutionLog,
} from "@/lib/api/elsa";
import type { ActivityExecutionRecordSummary, ActivityStatus } from "@/lib/api/types";

type TimeMetricMode = "relative" | "accumulated";

type Props = {
  instanceId: string;
  /** The currently-selected journal entry id, when one is. */
  selectedEntryId?: string | null;
  /** Called with the entry id when the user clicks a row. */
  onSelect?: (entry: ActivityExecutionRecordSummary) => void;
};

/**
 * Workflow-level lifecycle events worth interleaving alongside the activity
 * summary rows. Excludes `Started` / `Completed` because the activity summary
 * roll-up already represents the run boundaries for the root activity — these
 * are the events the summary can't surface.
 */
const LIFECYCLE_EVENT_NAMES = new Set([
  "Suspended",
  "Resumed",
  "Faulted",
  "Canceled",
  "Cancelled",
  "Workflow cancelled",
  "Workflow Faulted",
  "Activity cancelled",
  "Precondition Failed",
]);

type JournalRow =
  | {
      kind: "activity";
      key: string;
      timestampMs: number;
      /**
       * Secondary sort key used to break ties when multiple rows share a
       * timestamp. Activity rows don't carry a sequence on the wire, so they
       * sit at `Number.MAX_SAFE_INTEGER` — that places them AFTER any
       * workflow-log event of the same timestamp (lifecycle events naturally
       * fire before the activity Started they describe).
       */
      sequence: number;
      entry: ActivityExecutionRecordSummary;
    }
  | {
      kind: "event";
      key: string;
      timestampMs: number;
      /** Monotonic per-instance sequence from the workflow execution log. */
      sequence: number;
      eventName: string;
      timestamp: string;
      message?: string | null;
      activityNodeId?: string;
      activityName?: string | null;
      activityType?: string;
    };

/**
 * Vertical timeline of activity executions for a workflow instance. Ordered
 * chronologically (oldest at the top), matching Blazor's `Journal.razor`
 * which sorts by execution-log `Sequence` ascending. Rendered as a compact
 * list so it sits comfortably in a 30%-width pane.
 */
export function Journal({ instanceId, selectedEntryId, onSelect }: Props) {
  const q = useActivityExecutionSummaries(instanceId, { refetchInterval: 5000 });
  // Filter at the server to only lifecycle events we want as supplemental
  // rows — keeps payload small and matches what we render. Without a filter
  // the server returns every Started/Completed too, which the summary feed
  // already covers.
  const lifecycleEvents = useMemo(
    () => ({ eventNames: Array.from(LIFECYCLE_EVENT_NAMES) }),
    [],
  );
  const log = useWorkflowExecutionLog(instanceId, {
    filter: lifecycleEvents,
    refetchInterval: 5000,
    pageSize: 500,
  });
  const descriptors = useActivityDescriptors();
  const [timeMode, setTimeMode] = useState<TimeMetricMode>("relative");
  const [incidentsOnly, setIncidentsOnly] = useState(false);

  const rows = useMemo<JournalRow[]>(() => {
    const out: JournalRow[] = [];
    for (const e of q.data ?? []) {
      out.push({
        kind: "activity",
        key: `a:${e.id}`,
        timestampMs: new Date(e.startedAt).getTime(),
        // Activity summaries don't carry a sequence — sort after any log
        // event sharing the timestamp so the lifecycle row (e.g. "Workflow
        // Started") still appears above the corresponding activity row.
        sequence: Number.MAX_SAFE_INTEGER,
        entry: e,
      });
    }
    for (const r of log.data?.items ?? []) {
      if (!r.eventName || !LIFECYCLE_EVENT_NAMES.has(r.eventName)) continue;
      out.push({
        kind: "event",
        key: `e:${r.id}`,
        timestampMs: new Date(r.timestamp).getTime(),
        sequence: r.sequence,
        eventName: r.eventName,
        timestamp: r.timestamp,
        message: r.message,
        activityNodeId: r.nodeId,
        activityName: r.activityName,
        activityType: r.activityType,
      });
    }
    // Chronological ascending — top of the list = first thing that happened.
    // Matches Blazor's `Journal.razor` (ordered by `Sequence` ASC server-side).
    // Workflow → Flowchart → first activity falls out of time order naturally.
    out.sort(
      (a, b) => a.timestampMs - b.timestampMs || a.sequence - b.sequence,
    );
    return out;
  }, [q.data, log.data]);

  // Earliest timestamp across all rows — the accumulated-time metric anchors
  // here so toggling the incidents filter doesn't shift the offsets.
  const earliestStartMs = useMemo(() => {
    if (rows.length === 0) return null;
    let min = Infinity;
    for (const r of rows) if (r.timestampMs < min) min = r.timestampMs;
    return Number.isFinite(min) ? min : null;
  }, [rows]);

  const visibleRows = useMemo(() => {
    if (!incidentsOnly) return rows;
    return rows.filter((r) =>
      r.kind === "activity"
        ? r.entry.status === "Faulted"
        : r.eventName === "Faulted" ||
          r.eventName === "Workflow Faulted" ||
          r.eventName === "Precondition Failed",
    );
  }, [rows, incidentsOnly]);

  if (q.isPending) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading journal…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Couldn&apos;t load the execution journal.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Journal
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          <CopyButton
            value={() => JSON.stringify(visibleRows, null, 2)}
            label="Copy timeline as JSON"
            successMessage="Copied timeline."
          />
          <Button
            variant={timeMode === "accumulated" ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() =>
              setTimeMode((m) => (m === "relative" ? "accumulated" : "relative"))
            }
            aria-pressed={timeMode === "accumulated"}
            aria-label={
              timeMode === "relative"
                ? "Switch to accumulated time"
                : "Switch to relative time"
            }
            title={
              timeMode === "relative"
                ? "Show accumulated time from instance start"
                : "Show relative time (duration of each step)"
            }
          >
            {timeMode === "relative" ? (
              <Clock className="size-3.5" />
            ) : (
              <TimerReset className="size-3.5" />
            )}
          </Button>
          <Button
            variant={incidentsOnly ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setIncidentsOnly((v) => !v)}
            aria-pressed={incidentsOnly}
            aria-label={
              incidentsOnly ? "Show all events" : "Show incidents only"
            }
            title={
              incidentsOnly ? "Show all events" : "Show incidents only"
            }
          >
            <AlertTriangle
              className={[
                "size-3.5",
                incidentsOnly ? "text-rose-600" : "",
              ].join(" ")}
            />
          </Button>
        </div>
      </div>
      {visibleRows.length === 0 ? (
        <div className="text-muted-foreground p-4 text-sm">
          {incidentsOnly ? "No incidents." : "No activity executions yet."}
        </div>
      ) : (
        <ol className="flex-1 divide-y overflow-auto">
          {visibleRows.map((row) => {
            if (row.kind === "activity") {
              const e = row.entry;
              const descriptor =
                descriptors.data?.find((d) => d.typeName === e.activityType) ?? null;
              const display = displayFor(e.activityType, descriptor);
              const Icon = display.icon;
              const isSelected = selectedEntryId === e.id;
              return (
                <li
                  key={row.key}
                  onClick={() => onSelect?.(e)}
                  className={[
                    "flex cursor-pointer items-start gap-2.5 px-3 py-2 transition-colors",
                    isSelected ? "bg-sky-500/10" : "hover:bg-muted/40",
                  ].join(" ")}
                >
                  <div
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-white"
                    style={{ background: display.color }}
                  >
                    <Icon className="size-3.5" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className="truncate text-sm font-medium"
                        title={entryLabel(e, descriptor?.displayName)}
                      >
                        {entryLabel(e, descriptor?.displayName)}
                      </p>
                      <StatusPill status={e.status} />
                    </div>
                    <p
                      className="text-muted-foreground truncate font-mono text-[10.5px]"
                      title={e.activityType}
                    >
                      {descriptor?.displayName ?? shortType(e.activityType)}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      {timeMode === "accumulated" && earliestStartMs != null
                        ? `+${formatOffset(row.timestampMs - earliestStartMs)}`
                        : format(new Date(e.startedAt), "HH:mm:ss")}
                      {e.completedAt
                        ? ` · took ${duration(e.startedAt, e.completedAt)}`
                        : null}
                    </p>
                  </div>
                </li>
              );
            }
            const lifecycle = lifecycleDisplay(row.eventName);
            const LifeIcon = lifecycle.Icon;
            return (
              <li
                key={row.key}
                className="flex items-start gap-2.5 px-3 py-2"
              >
                <div
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-white ${lifecycle.bg}`}
                >
                  <LifeIcon className="size-3.5" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {lifecycle.label}
                    </p>
                    <Badge
                      variant="outline"
                      className={[
                        "whitespace-nowrap font-normal",
                        lifecycle.pillTone,
                      ].join(" ")}
                    >
                      Event
                    </Badge>
                  </div>
                  {row.message ? (
                    <p
                      className="text-muted-foreground truncate text-[11px]"
                      title={row.message}
                    >
                      {row.message}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground text-[10px]">
                    {timeMode === "accumulated" && earliestStartMs != null
                      ? `+${formatOffset(row.timestampMs - earliestStartMs)}`
                      : format(new Date(row.timestamp), "HH:mm:ss")}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/**
 * Visual treatment for a workflow lifecycle event row. Maps the wire-level
 * `eventName` ("Suspended", "Faulted", …) to an icon + tone so the journal
 * differentiates these from activity rows at a glance.
 */
function lifecycleDisplay(eventName: string): {
  label: string;
  Icon: LucideIcon;
  bg: string;
  pillTone: string;
} {
  switch (eventName) {
    case "Suspended":
      return {
        label: "Workflow Suspended",
        Icon: Pause,
        bg: "bg-amber-500",
        pillTone:
          "border-amber-600 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "Resumed":
      return {
        label: "Workflow Resumed",
        Icon: Play,
        bg: "bg-sky-500",
        pillTone: "border-sky-600 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
    case "Faulted":
    case "Workflow Faulted":
      return {
        label: "Workflow Faulted",
        Icon: AlertOctagon,
        bg: "bg-rose-600",
        pillTone:
          "border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    case "Canceled":
    case "Cancelled":
    case "Workflow cancelled":
    case "Activity cancelled":
      return {
        label: eventName === "Activity cancelled" ? "Activity Cancelled" : "Workflow Cancelled",
        Icon: CircleDashed,
        bg: "bg-amber-600",
        pillTone:
          "border-amber-600 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "Precondition Failed":
      return {
        label: "Precondition Failed",
        Icon: AlertTriangle,
        bg: "bg-rose-500",
        pillTone:
          "border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-300",
      };
    default:
      return {
        label: eventName,
        Icon: AlertCircle,
        bg: "bg-slate-500",
        pillTone: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
      };
  }
}

/** Format `ms` as `MM:SS.fff` (or `H:MM:SS.fff` past 1 hour) for accumulated-time mode. */
function formatOffset(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMs = Math.floor(ms);
  const totalSec = Math.floor(totalMs / 1000);
  const millis = totalMs % 1000;
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  const fff = millis.toString().padStart(3, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}.${fff}`;
  return `${mm}:${ss}.${fff}`;
}

function entryLabel(
  e: ActivityExecutionRecordSummary,
  descriptorDisplayName: string | null | undefined,
): string {
  return (
    e.activityName?.trim() ||
    descriptorDisplayName?.trim() ||
    e.activityId ||
    shortType(e.activityType)
  );
}

function shortType(typeName: string): string {
  const segs = typeName.split(".");
  return segs[segs.length - 1] ?? typeName;
}

function duration(startedAt: string, completedAt: string): string {
  return formatDistanceStrict(new Date(startedAt), new Date(completedAt), {
    addSuffix: false,
  });
}

function StatusPill({ status }: { status: ActivityStatus }) {
  const map: Record<ActivityStatus, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
    Completed: { label: "OK", tone: "border-emerald-600 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
    Running: { label: "Running", tone: "border-sky-600 bg-sky-500/10 text-sky-700 dark:text-sky-300", Icon: Play },
    Pending: { label: "Pending", tone: "border-muted-foreground bg-muted/40 text-muted-foreground", Icon: Hourglass },
    Faulted: { label: "Faulted", tone: "border-rose-600 bg-rose-500/10 text-rose-700 dark:text-rose-300", Icon: AlertCircle },
    Cancelled: { label: "Cancelled", tone: "border-amber-600 bg-amber-500/10 text-amber-700 dark:text-amber-300", Icon: CircleDashed },
    Canceled: { label: "Cancelled", tone: "border-amber-600 bg-amber-500/10 text-amber-700 dark:text-amber-300", Icon: CircleDashed },
  };
  const cfg = map[status] ?? map.Pending;
  return (
    <Badge variant="outline" className={["whitespace-nowrap font-normal", cfg.tone].join(" ")}>
      <cfg.Icon className="mr-0.5 size-3" />
      {cfg.label}
    </Badge>
  );
}
