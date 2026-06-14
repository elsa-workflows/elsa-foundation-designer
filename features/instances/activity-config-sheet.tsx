"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ActivityExecutionsPanel } from "@/features/instances/activity-executions";
import { CopyButton } from "@/features/instances/copy-button";
import { displayFor } from "@/features/workflows/activity-display";
import { findActivityById } from "@/features/workflows/editor-store";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type { ActivityJson, WorkflowDefinition } from "@/lib/api/types";

type Props = {
  /** Open when this is non-null. */
  activityId: string | null;
  /** Definition of the workflow being viewed (for resolving the activity). */
  definition: WorkflowDefinition | null | undefined;
  /** Instance id powering the per-activity execution list. */
  instanceId: string;
  onOpenChange: (open: boolean) => void;
  /** Open the execution-details sheet for the given record id. */
  onSelectRecord: (recordId: string) => void;
};

/**
 * Read-only "Activity" pane for the instance viewer. When the user clicks a
 * node on the canvas, this sheet opens with two sections:
 *
 *   1. **Configuration** — the static activity JSON from the definition,
 *      rendered as flat key-value rows and a copyable raw blob.
 *   2. **Executions** — the runtime execution-record summaries for this
 *      activity, reusing `ActivityExecutionsPanel`.
 *
 * Closing the sheet leaves the canvas selection intact so the highlight
 * stays in place. The sheet replaces what Blazor surfaces as the right-pane
 * Activity + Executions tab pair, without rebuilding the whole property
 * editor for read-only mode.
 */
export function ActivityConfigSheet({
  activityId,
  definition,
  instanceId,
  onOpenChange,
  onSelectRecord,
}: Props) {
  const descriptors = useActivityDescriptors();
  const activity = useMemo<ActivityJson | null>(
    () => (activityId ? findActivityById(definition?.root ?? null, activityId) : null),
    [definition?.root, activityId],
  );
  const descriptor = useMemo(
    () => descriptors.data?.find((d) => d.typeName === activity?.type) ?? null,
    [descriptors.data, activity?.type],
  );
  const display = activity ? displayFor(activity.type, descriptor) : null;
  const open = !!activityId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[420px] !max-w-none gap-0 overflow-hidden">
        <SheetHeader className="border-b">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {display ? (
                <div
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-white"
                  style={{ background: display.color }}
                >
                  <display.icon className="size-3.5" />
                </div>
              ) : null}
              <div className="flex min-w-0 flex-col">
                <SheetTitle>
                  {(activity?.metadata?.displayText as string | undefined)?.trim() ||
                    descriptor?.displayName ||
                    (activity ? short(activity.type) : "Activity")}
                </SheetTitle>
                <SheetDescription>
                  {activity ? (
                    <span className="font-mono text-2xs">
                      {activity.type}
                      {activity.version ? ` v${activity.version}` : ""}
                    </span>
                  ) : descriptors.isPending ? (
                    "Loading…"
                  ) : (
                    "Activity not found in this definition."
                  )}
                </SheetDescription>
              </div>
            </div>
            {activity ? (
              <CopyButton
                value={() => JSON.stringify(activity, null, 2)}
                label="Copy activity JSON"
                successMessage="Copied activity."
              />
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 text-sm">
          {!activity ? (
            descriptors.isPending ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : null
          ) : (
            <>
              <ConfigurationSection activity={activity} />
              <ExecutionsSection
                instanceId={instanceId}
                onSelectRecord={onSelectRecord}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Render the activity's static configuration as key-value rows. Skips the
 * fields that are noise here (`id`, `nodeId`, `type`, `version`, `metadata`)
 * because they're either shown in the header already or designer-internal.
 */
function ConfigurationSection({ activity }: { activity: ActivityJson }) {
  const SKIP = new Set(["id", "nodeId", "type", "version", "metadata"]);
  const entries = Object.entries(activity).filter(([k, v]) => {
    if (SKIP.has(k)) return false;
    if (v == null) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "object" && Object.keys(v as object).length === 0) return false;
    return true;
  });
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        No configured properties on this activity.
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        Configuration
      </h3>
      <div className="divide-y rounded-md border bg-muted/20">
        {entries.map(([key, value]) => (
          <KVRow key={key} k={key} v={value} />
        ))}
      </div>
    </section>
  );
}

function KVRow({ k, v }: { k: string; v: unknown }) {
  const text = formatValue(v);
  const isLong = text.length > 80 || text.includes("\n");
  const [open, setOpen] = useState(false);
  if (isLong) {
    return (
      <div className="px-3 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1 text-left text-[11px] font-medium"
        >
          {open ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          {k}
        </button>
        {open ? (
          <pre className="bg-background mt-1 max-h-48 overflow-auto rounded border px-2 py-1 text-[10.5px] leading-tight">
            {text}
          </pre>
        ) : null}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[max-content_1fr_auto] items-center gap-2 px-3 py-1.5">
      <p className="text-muted-foreground text-[11px]">{k}</p>
      <p className="truncate font-mono text-[11px]" title={text}>
        {text}
      </p>
      <CopyButton
        value={text}
        variant="inline"
        label={`Copy ${k}`}
        successMessage={`Copied ${k}.`}
      />
    </div>
  );
}

function ExecutionsSection({
  instanceId,
  onSelectRecord,
}: {
  instanceId: string;
  onSelectRecord: (recordId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        Executions
      </h3>
      <div className="overflow-hidden rounded-md border bg-muted/20">
        <ActivityExecutionsPanel
          instanceId={instanceId}
          onSelect={onSelectRecord}
        />
      </div>
    </section>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function short(typeName: string): string {
  const segs = typeName.split(".");
  return segs[segs.length - 1] ?? typeName;
}
