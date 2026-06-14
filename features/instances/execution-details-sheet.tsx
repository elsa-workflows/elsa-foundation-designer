"use client";

import { format } from "date-fns";
import { AlertCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ActivityExecutionsPanel } from "@/features/instances/activity-executions";
import { CallStack } from "@/features/instances/call-stack";
import { CopyButton } from "@/features/instances/copy-button";
import {
  useActivityExecutionRecord,
  useActivityExecutionRetries,
  type RetryAttemptRecord,
} from "@/lib/api/elsa";

type Props = {
  /** ActivityExecutionRecord id (the journal entry id). */
  recordId: string | null;
  onOpenChange: (open: boolean) => void;
};

/**
 * Side panel rendering the full record for a journal entry: inputs / outputs /
 * exception / timing. Opens when the user clicks a Journal row.
 */
export function ExecutionDetailsSheet({ recordId, onOpenChange }: Props) {
  const q = useActivityExecutionRecord(recordId);

  const open = !!recordId;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="!w-[480px] !max-w-none gap-0 overflow-hidden">
        <SheetHeader className="border-b">
          <div className="flex items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <SheetTitle>
                {q.data?.activityName?.trim() || (q.data ? short(q.data.activityType) : "Execution")}
              </SheetTitle>
              <SheetDescription>
                {q.data ? (
                  <>
                    {q.data.status} ·{" "}
                    {format(new Date(q.data.startedAt), "HH:mm:ss")}
                    {q.data.completedAt
                      ? ` → ${format(new Date(q.data.completedAt), "HH:mm:ss")}`
                      : " (in progress)"}
                  </>
                ) : (
                  "Loading record…"
                )}
              </SheetDescription>
            </div>
            {q.data ? (
              <CopyButton
                value={() => JSON.stringify(q.data, null, 2)}
                label="Copy full execution record as JSON"
                successMessage="Copied record."
              />
            ) : null}
          </div>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 text-sm">
          {q.isPending ? (
            <div className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Loading details…
            </div>
          ) : q.isError || !q.data ? (
            <div className="text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" /> Couldn&apos;t load this record.
            </div>
          ) : (
            <>
              <Section
                title="Activity"
                value={`${q.data.activityType}${
                  q.data.activityTypeVersion ? ` v${q.data.activityTypeVersion}` : ""
                }`}
                mono
              />
              <Section title="Activity id" value={q.data.activityId} mono />
              <Section title="Node id" value={q.data.activityNodeId} mono />
              {q.data.exception ? (
                <ExceptionBlock exception={q.data.exception} />
              ) : null}
              <JsonSection title="Inputs" value={q.data.activityState ?? null} />
              <JsonSection title="Outputs" value={q.data.outputs ?? null} />
              <JsonSection title="Payload" value={q.data.payload ?? null} />
              <JsonSection title="Properties" value={q.data.properties ?? null} />
              <JsonSection title="Metadata" value={q.data.metadata ?? null} />
              <RetriesPanel activityInstanceId={q.data.id} />
              <CallStackSection activityExecutionId={q.data.id} />
              <OtherExecutionsSection
                instanceId={q.data.workflowInstanceId}
                currentRecordId={q.data.id}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Resilience-module retry attempts for the selected execution. Renders
 * nothing when the backend returns no attempts (or 404 — the module is
 * optional). Otherwise shows a small table of attempt # / delay / detail keys.
 */
function RetriesPanel({ activityInstanceId }: { activityInstanceId: string }) {
  const q = useActivityExecutionRetries(activityInstanceId);
  const [open, setOpen] = useState(true);
  const items = q.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/30">
      <div className="group flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          Retries · {items.length}
        </button>
        <CopyButton
          value={() => JSON.stringify(items, null, 2)}
          variant="inline"
          label="Copy retries as JSON"
          successMessage="Copied retries."
        />
      </div>
      {open ? (
        <div className="border-t bg-background">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left font-medium">#</th>
              <th className="px-2 py-1 text-left font-medium">Delay</th>
              <th className="px-2 py-1 text-left font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1 tabular-nums">{r.attemptNumber}</td>
                <td className="px-2 py-1 font-mono">{formatRetryDelay(r.retryDelay)}</td>
                <td className="px-2 py-1">{summariseDetails(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : null}
    </div>
  );
}

/**
 * Render an ISO-8601 duration ("PT2S", "PT1M30S") as a short human form.
 * Falls back to the raw string when the pattern doesn't match.
 */
function formatRetryDelay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return iso;
  const [, h, mm, s] = m;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (mm) parts.push(`${mm}m`);
  if (s) parts.push(`${s}s`);
  return parts.length ? parts.join(" ") : "0s";
}

function summariseDetails(r: RetryAttemptRecord): string {
  if (!r.details) return "—";
  const entries = Object.entries(r.details);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}=${v}`).join(", ");
}

/** Rich rendering of an activity execution's exception, with copy affordances. */
function ExceptionBlock({
  exception,
}: {
  exception: { type?: string; message?: string; stackTrace?: string };
}) {
  return (
    <div className="rounded-md border border-rose-300 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30">
      <div className="flex items-center gap-2 px-3 py-2 text-rose-900 dark:text-rose-200">
        <span className="flex-1 text-xs font-medium uppercase tracking-wide">
          Exception · {exception.type ?? "Error"}
        </span>
        <CopyButton
          value={() => JSON.stringify(exception, null, 2)}
          variant="inline"
          label="Copy exception as JSON"
          successMessage="Copied exception."
        />
      </div>
      <div className="space-y-2 border-t border-rose-300/60 px-3 py-2 dark:border-rose-800/60">
        {exception.message ? (
          <div className="flex items-start gap-2">
            <p className="flex-1 text-rose-900 dark:text-rose-100">{exception.message}</p>
            <CopyButton
              value={exception.message}
              variant="inline"
              label="Copy exception message"
              successMessage="Copied message."
            />
          </div>
        ) : null}
        {exception.stackTrace ? (
          <div className="group relative">
            <div className="absolute right-1 top-1 z-10">
              <CopyButton
                value={exception.stackTrace}
                variant="inline"
                label="Copy stack trace"
                successMessage="Copied stack trace."
              />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap pr-8 text-[10.5px] leading-tight text-rose-900/80 dark:text-rose-100/70">
              {exception.stackTrace}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, value, mono = false }: { title: string; value: string; mono?: boolean }) {
  return (
    <div className="group space-y-0.5">
      <div className="flex items-center gap-2">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
          {title}
        </p>
        <CopyButton
          value={value}
          variant="inline"
          label={`Copy ${title.toLowerCase()}`}
          successMessage={`Copied ${title.toLowerCase()}.`}
        />
      </div>
      <p className={mono ? "font-mono text-xs" : "text-sm"}>{value}</p>
    </div>
  );
}

function JsonSection({
  title,
  value,
  defaultOpen = false,
}: {
  title: string;
  value: Record<string, unknown> | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!value || Object.keys(value).length === 0) return null;
  return (
    <div className="rounded-md border bg-muted/30">
      <div className="group flex items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          {title}
        </button>
        <CopyButton
          value={() => JSON.stringify(value, null, 2)}
          variant="inline"
          label={`Copy ${title.toLowerCase()} as JSON`}
          successMessage={`Copied ${title.toLowerCase()}.`}
        />
      </div>
      {open ? (
        <pre className="overflow-auto border-t bg-background px-3 py-2 text-[11px] leading-tight">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/**
 * Collapsible Call stack section embedded inside the per-record sheet so
 * users don't need a separate top-level tab for what's a contextual view.
 */
function CallStackSection({ activityExecutionId }: { activityExecutionId: string }) {
  return (
    <details className="rounded-md border bg-muted/30">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Call stack
      </summary>
      <div className="border-t bg-background max-h-80 overflow-auto">
        <CallStack activityExecutionId={activityExecutionId} />
      </div>
    </details>
  );
}

/**
 * Collapsible "Other executions of this activity" section — same purpose as
 * the previous top-level Executions tab, but only useful in context. We pass
 * a `currentRecordId` so the active row stays highlighted.
 */
function OtherExecutionsSection({
  instanceId,
  currentRecordId,
}: {
  instanceId: string;
  currentRecordId: string;
}) {
  return (
    <details className="rounded-md border bg-muted/30">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Other executions of this activity
      </summary>
      <div className="border-t bg-background max-h-80 overflow-auto">
        <ActivityExecutionsPanel
          instanceId={instanceId}
          selectedRecordId={currentRecordId}
        />
      </div>
    </details>
  );
}

function short(typeName: string): string {
  const segs = typeName.split(".");
  return segs[segs.length - 1] ?? typeName;
}
