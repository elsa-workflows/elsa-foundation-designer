"use client";

import { formatDistanceStrict } from "date-fns";
import { Layers, Loader2 } from "lucide-react";

import { displayFor } from "@/features/workflows/activity-display";
import { useActivityCallStack, useActivityDescriptors } from "@/lib/api/elsa";

type Props = {
  /** Currently-selected execution record id (from the journal). */
  activityExecutionId: string | null;
  /** Called when the user clicks a call-stack entry. */
  onSelect?: (entry: { activityExecutionId: string; activityId: string }) => void;
  /** Highlight one of the entries (e.g. the currently-selected journal entry). */
  selectedExecutionId?: string | null;
};

/**
 * Renders the call stack for a selected activity execution — the nested
 * execution chain that produced this record. Mirrors Blazor's
 * `ActivityCallStack.razor`. Driven by `useActivityCallStack`, which talks to
 * `GET /activity-executions/{id}/call-stack`. Empty state when no entry is
 * selected; loading state while the query is in flight.
 */
export function CallStack({
  activityExecutionId,
  onSelect,
  selectedExecutionId,
}: Props) {
  const q = useActivityCallStack(activityExecutionId ?? undefined);
  const descriptors = useActivityDescriptors();

  if (!activityExecutionId) {
    return (
      <EmptyState>
        Click a journal entry to see its call stack — the chain of nested
        activity executions that led to this record.
      </EmptyState>
    );
  }

  if (q.isPending) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading call stack…
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="text-muted-foreground p-4 text-sm">
        Couldn&apos;t load the call stack.
      </div>
    );
  }

  const items = q.data?.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState>
        No call-stack entries for the selected execution.
      </EmptyState>
    );
  }

  return (
    <ol className="flex h-full flex-col divide-y overflow-auto">
      {items.map((entry, i) => {
        const descriptor =
          descriptors.data?.find((d) => d.typeName === entry.activityType) ?? null;
        const display = displayFor(entry.activityType, descriptor);
        const Icon = display.icon;
        const label =
          entry.activityName?.trim() ||
          descriptor?.displayName?.trim() ||
          entry.activityId ||
          shortType(entry.activityType);
        const dur =
          entry.startedAt && entry.completedAt
            ? formatDistanceStrict(new Date(entry.startedAt), new Date(entry.completedAt))
            : "—";
        const isSelected = selectedExecutionId === entry.activityExecutionId;
        return (
          <li
            key={`${entry.activityExecutionId}:${i}`}
            onClick={() =>
              onSelect?.({
                activityExecutionId: entry.activityExecutionId,
                activityId: entry.activityId,
              })
            }
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
              <p className="truncate text-sm font-medium" title={label}>
                {label}
              </p>
              <p
                className="text-muted-foreground truncate font-mono text-[10.5px]"
                title={entry.activityType}
              >
                {descriptor?.displayName ?? shortType(entry.activityType)}
              </p>
              <p className="text-muted-foreground text-[10px]">
                {entry.status ?? "—"} · {dur}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function shortType(typeName: string): string {
  const segs = typeName.split(".");
  return segs[segs.length - 1] ?? typeName;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Layers className="size-5 opacity-50" />
      <p className="max-w-[28ch] text-xs leading-relaxed">{children}</p>
    </div>
  );
}
