"use client";

import {
  AlertCircle,
  Bookmark,
  Braces,
  ChevronDown,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Inbox,
  Loader2,
  Send,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/features/instances/copy-button";
import { useEditorStore } from "@/features/workflows/editor-store";
import { useWorkflowInstance, useWorkflowInstanceState } from "@/lib/api/elsa";

type Props = { instanceId: string };

/** Workflow-level variable values from the live instance state. */
export function VariablesPane({ instanceId }: Props) {
  const q = useWorkflowInstanceState(instanceId, { refetchInterval: 5000 });
  if (q.isPending) return <Loading />;
  const entries = Object.entries(q.data?.variables ?? {});
  if (entries.length === 0) {
    return <Empty>This instance hasn&apos;t recorded any variable values yet.</Empty>;
  }
  return (
    <KeyValueTable
      rows={entries.map(([k, v]) => ({ key: k, value: v }))}
    />
  );
}

/** Workflow input values (as provided when the instance was started). */
export function InputsPane({ instanceId }: Props) {
  const q = useWorkflowInstanceState(instanceId, { refetchInterval: 5000 });
  if (q.isPending) return <Loading />;
  const entries = Object.entries(q.data?.input ?? {});
  if (entries.length === 0) return <Empty>No inputs were passed when this instance started.</Empty>;
  return (
    <KeyValueTable
      rows={entries.map(([k, v]) => ({ key: k, value: v }))}
    />
  );
}

/** Workflow outputs — populated once activities have written their bound outputs. */
export function OutputsPane({ instanceId }: Props) {
  const q = useWorkflowInstanceState(instanceId, { refetchInterval: 5000 });
  if (q.isPending) return <Loading />;
  const entries = Object.entries(q.data?.output ?? {});
  if (entries.length === 0) return <Empty>No outputs have been written yet.</Empty>;
  return (
    <KeyValueTable
      rows={entries.map(([k, v]) => ({ key: k, value: v }))}
    />
  );
}

export function IncidentsPane({ instanceId }: Props) {
  const q = useWorkflowInstanceState(instanceId, { refetchInterval: 5000 });
  const setSelectedActivityId = useEditorStore((s) => s.setSelectedActivityId);
  if (q.isPending) return <Loading />;
  const items = q.data?.incidents ?? [];
  if (items.length === 0) return <Empty>No incidents recorded.</Empty>;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="text-muted-foreground text-xs">
          {items.length} {items.length === 1 ? "incident" : "incidents"}
        </span>
        <div className="ml-auto">
          <CopyButton
            value={() => JSON.stringify(items, null, 2)}
            label="Copy all incidents as JSON"
            successMessage="Copied incidents."
          />
        </div>
      </div>
      <ol className="flex flex-col gap-2 overflow-auto p-3">
        {items.map((inc, i) => {
          // Server shape (`ActivityIncident`): { activityId, activityNodeId,
          // activityType, message, exception?: { type, message, stackTrace },
          // timestamp }. There is no top-level `id` — incidents are anonymous
          // entries on the workflow state.
          const exceptionType = inc.exception?.type;
          const stackTrace = inc.exception?.stackTrace;
          const exceptionMessage = inc.exception?.message;
          return (
            <li
              key={`${inc.activityNodeId}-${inc.timestamp}-${i}`}
              className="group rounded-md border border-rose-300/60 bg-rose-50/40 p-2 text-xs dark:border-rose-800/60 dark:bg-rose-950/30"
            >
              <div className="flex items-start gap-1.5">
                <AlertCircle className="text-rose-600 size-3.5 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  {exceptionType ? (
                    <p className="font-mono text-rose-900 dark:text-rose-200">
                      {exceptionType}
                    </p>
                  ) : (
                    <p className="font-mono text-rose-900 dark:text-rose-200">
                      {inc.activityType}
                    </p>
                  )}
                  {inc.message ? (
                    <p className="text-rose-900/90 dark:text-rose-100/90">{inc.message}</p>
                  ) : null}
                  {exceptionMessage && exceptionMessage !== inc.message ? (
                    <p className="text-rose-900/80 dark:text-rose-100/80">
                      {exceptionMessage}
                    </p>
                  ) : null}
                  {inc.activityId ? (
                    <p className="text-muted-foreground font-mono text-[10px]">
                      Activity: {inc.activityId}
                    </p>
                  ) : null}
                  {stackTrace ? (
                    <pre className="text-muted-foreground mt-1 overflow-auto whitespace-pre-wrap text-[10px] leading-tight">
                      {stackTrace}
                    </pre>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <CopyButton
                    value={() => JSON.stringify(inc, null, 2)}
                    variant="inline"
                    label="Copy incident details"
                    successMessage="Copied incident."
                  />
                  {inc.activityId ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="View this activity on the canvas"
                      title="View on canvas"
                      onClick={() => setSelectedActivityId(inc.activityId ?? null)}
                    >
                      <Crosshair className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BookmarksPane({ instanceId }: Props) {
  const q = useWorkflowInstanceState(instanceId, { refetchInterval: 5000 });
  if (q.isPending) return <Loading />;
  const items = q.data?.bookmarks ?? [];
  if (items.length === 0) return <Empty>No bookmarks — nothing is waiting.</Empty>;
  return (
    <ol className="flex flex-col gap-1 p-3">
      {items.map((b) => (
        <li key={b.id} className="bg-muted/30 rounded-md border p-2 text-xs">
          <div className="flex items-start gap-1.5">
            <Bookmark className="size-3.5 shrink-0" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="truncate font-medium">{b.name || "(unnamed)"}</p>
              <p className="text-muted-foreground truncate font-mono text-[10px]">
                {b.activityNodeId}
              </p>
              {b.hash ? (
                <p className="text-muted-foreground truncate font-mono text-[10px]">
                  hash: {b.hash}
                </p>
              ) : null}
            </div>
            <Badge variant="outline" className="ml-auto font-mono text-[9.5px]">
              {b.id.slice(0, 6)}
            </Badge>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Unified "Data" pane consolidating Variables / Inputs / Outputs / Bookmarks
 * into one scrollable view with collapsible sections. Replaces four separate
 * tabs so the viewer's left strip stays scannable.
 *
 * The hook for `useWorkflowInstanceState` is shared by React Query — calling
 * it once here costs the same as calling it inside each child pane.
 */
export function DataPane({ instanceId }: Props) {
  const q = useWorkflowInstanceState(instanceId, { refetchInterval: 5000 });
  if (q.isPending) return <Loading />;

  const variables = Object.entries(q.data?.variables ?? {});
  const inputs = Object.entries(q.data?.input ?? {});
  const outputs = Object.entries(q.data?.output ?? {});
  const bookmarks = q.data?.bookmarks ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto">
      <Section
        title="Variables"
        icon={<Braces className="size-3.5" />}
        count={variables.length}
        defaultOpen
        copyValue={() => JSON.stringify(q.data?.variables ?? {}, null, 2)}
      >
        {variables.length === 0 ? (
          <Empty>This instance hasn&apos;t recorded any variable values yet.</Empty>
        ) : (
          <KeyValueTable rows={variables.map(([k, v]) => ({ key: k, value: v }))} />
        )}
      </Section>
      <Section
        title="Inputs"
        icon={<Inbox className="size-3.5" />}
        count={inputs.length}
        defaultOpen={inputs.length > 0}
        copyValue={() => JSON.stringify(q.data?.input ?? {}, null, 2)}
      >
        {inputs.length === 0 ? (
          <Empty>No inputs were passed when this instance started.</Empty>
        ) : (
          <KeyValueTable rows={inputs.map(([k, v]) => ({ key: k, value: v }))} />
        )}
      </Section>
      <Section
        title="Outputs"
        icon={<Send className="size-3.5" />}
        count={outputs.length}
        defaultOpen={outputs.length > 0}
        copyValue={() => JSON.stringify(q.data?.output ?? {}, null, 2)}
      >
        {outputs.length === 0 ? (
          <Empty>No outputs have been written yet.</Empty>
        ) : (
          <KeyValueTable rows={outputs.map(([k, v]) => ({ key: k, value: v }))} />
        )}
      </Section>
      <Section
        title="Bookmarks"
        icon={<Bookmark className="size-3.5" />}
        count={bookmarks.length}
        defaultOpen={bookmarks.length > 0}
        copyValue={() => JSON.stringify(bookmarks, null, 2)}
      >
        {bookmarks.length === 0 ? (
          <Empty>No bookmarks — nothing is waiting.</Empty>
        ) : (
          <ol className="flex flex-col gap-1 p-3">
            {bookmarks.map((b) => (
              <li key={b.id} className="bg-muted/30 rounded-md border p-2 text-xs">
                <div className="flex items-start gap-1.5">
                  <Bookmark className="size-3.5 shrink-0" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate font-medium">{b.name || "(unnamed)"}</p>
                    <p className="text-muted-foreground truncate font-mono text-[10px]">
                      {b.activityNodeId}
                    </p>
                    {b.hash ? (
                      <p className="text-muted-foreground truncate font-mono text-[10px]">
                        hash: {b.hash}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant="outline" className="ml-auto font-mono text-[9.5px]">
                    {b.id.slice(0, 6)}
                  </Badge>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

/**
 * Collapsible section used inside DataPane. Header shows icon + title + count
 * badge + a copy-section button (when `copyValue` is supplied). Clicking the
 * copy button doesn't toggle the section — the surrounding chrome handles
 * that via the header button.
 */
function Section({
  title,
  icon,
  count,
  defaultOpen = true,
  copyValue,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  /** When set, renders a Copy button that pulls this string into the clipboard. */
  copyValue?: () => string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b last:border-b-0">
      <div className="group hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span className="flex-1">{title}</span>
          {typeof count === "number" ? (
            <Badge
              variant="outline"
              className="font-mono text-[10px] tabular-nums"
              aria-label={`${count} ${title.toLowerCase()}`}
            >
              {count}
            </Badge>
          ) : null}
        </button>
        {copyValue && (count == null || count > 0) ? (
          <CopyButton
            value={copyValue}
            variant="inline"
            label={`Copy ${title.toLowerCase()} as JSON`}
            successMessage={`Copied ${title.toLowerCase()}.`}
          />
        ) : null}
      </div>
      {open ? <div>{children}</div> : null}
    </section>
  );
}

function Loading() {
  return (
    <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" /> Loading…
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground p-3 text-xs italic">{children}</p>
  );
}

function KeyValueTable({ rows }: { rows: Array<{ key: string; value: unknown }> }) {
  return (
    <div className="divide-y border-y text-xs">
      {rows.map(({ key, value }) => {
        const text = formatValue(value);
        return (
          <div
            key={key}
            className="group grid grid-cols-[1fr_2fr_auto] items-center gap-2 px-3 py-1.5"
          >
            <p className="truncate font-medium" title={key}>
              {key}
            </p>
            <p className="truncate font-mono text-[11px]" title={text}>
              {text}
            </p>
            <CopyButton
              value={text}
              variant="inline"
              label={`Copy value of ${key}`}
              successMessage={`Copied ${key}.`}
            />
          </div>
        );
      })}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * Surfaces "system" facts about the instance that don't fit in the existing
 * Variables/Inputs/Outputs/Incidents/Bookmarks panes:
 *  - sub-workflow parentage when this instance was started by another (link
 *    to the parent + a quick link to its viewer page);
 *  - the workflow-options-derived strategies (log persistence, incident
 *    handling) when present;
 *  - the full raw `workflowState` blob as a collapsible JSON viewer for
 *    debugging.
 *
 * The instance hook is intentionally loose (`Record<string, unknown>`), so
 * pull fields through narrow type guards rather than re-declaring a schema
 * that drifts from the server.
 */
export function DetailsPane({ instanceId }: Props) {
  const q = useWorkflowInstance(instanceId, { refetchInterval: 5000 });
  if (q.isPending) return <Loading />;
  if (!q.data) return <Empty>Couldn&apos;t load instance details.</Empty>;

  const data = q.data as Record<string, unknown>;
  const parentId = asString(data.parentWorkflowInstanceId);
  const workflowState = (data.workflowState ?? data.state) as Record<string, unknown> | undefined;
  // Strategy metadata typically lives on the parent definition options; here
  // we surface anything the instance carries through `customProperties` and
  // the embedded workflow state for transparency.
  const customProps = (data.customProperties ?? {}) as Record<string, unknown>;
  const logPersistence = asString(customProps.logPersistenceConfig)
    ?? readNested(customProps, ["logPersistenceConfig", "default"])
    ?? readNested(workflowState, ["properties", "LogPersistenceConfig", "default"]);
  const incidentStrategy =
    asString(data.incidentStrategyDisplayName) ??
    asString(data.incidentStrategyType) ??
    readNested(workflowState, ["properties", "IncidentStrategy"]);

  return (
    <div className="flex flex-col gap-4 p-3 text-xs">
      <section className="flex flex-col gap-1.5">
        <SectionLabel>Sub-workflow</SectionLabel>
        {parentId ? (
          <div className="bg-card group flex items-center gap-2 rounded-md border px-2 py-1.5">
            <ExternalLink className="text-muted-foreground size-3.5" />
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="text-muted-foreground text-[10px] uppercase tracking-wide">
                Parent instance
              </span>
              <Link
                href={`/workflows/instances/${parentId}`}
                className="hover:text-primary truncate font-mono text-[11px]"
                title={parentId}
              >
                {parentId.slice(0, 12)}…
              </Link>
            </div>
            <CopyButton
              value={parentId}
              variant="inline"
              label="Copy parent instance id"
              successMessage="Copied parent instance id."
            />
          </div>
        ) : (
          <p className="text-muted-foreground">Top-level workflow (no parent).</p>
        )}
      </section>

      {logPersistence || incidentStrategy ? (
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Strategies</SectionLabel>
          {incidentStrategy ? (
            <KV k="Incident strategy" v={incidentStrategy} />
          ) : null}
          {logPersistence ? (
            <KV k="Log persistence" v={logPersistence} />
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <SectionLabel>Workflow state</SectionLabel>
          {workflowState ? (
            <div className="ml-auto">
              <CopyButton
                value={() => JSON.stringify(workflowState, null, 2)}
                label="Copy workflow state JSON"
                successMessage="Copied workflow state."
              />
            </div>
          ) : null}
        </div>
        {workflowState ? (
          <details className="rounded-md border bg-muted/30">
            <summary className="cursor-pointer px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Raw JSON
            </summary>
            <pre className="overflow-auto border-t bg-background px-3 py-2 text-[10.5px] leading-tight">
              {JSON.stringify(workflowState, null, 2)}
            </pre>
          </details>
        ) : (
          <p className="text-muted-foreground">No state captured.</p>
        )}
      </section>
    </div>
  );
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

function readNested(obj: unknown, path: string[]): string | null {
  let cur: unknown = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[k];
  }
  return typeof cur === "string" ? cur : null;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
      {children}
    </p>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-3">
      <p className="text-muted-foreground">{k}</p>
      <p className="font-mono text-[11px]">{v}</p>
    </div>
  );
}
