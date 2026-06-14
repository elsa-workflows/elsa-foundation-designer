"use client";

import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Trash2,
  Wand2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useEditorStore } from "@/features/workflows/editor-store";
import { ActivityConfigSheet } from "@/features/instances/activity-config-sheet";
import { ElapsedTime } from "@/features/instances/elapsed-time";
import { ExecutionDetailsSheet } from "@/features/instances/execution-details-sheet";
import { Journal } from "@/features/instances/journal";
import {
  DataPane,
  DetailsPane,
  IncidentsPane,
} from "@/features/instances/state-panes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aggregateStatsByActivityId } from "@/features/workflows/activity-stats";
import { CanvasBreadcrumb } from "@/features/workflows/canvas-breadcrumb";
import { CanvasErrorBoundary } from "@/features/workflows/canvas-error-boundary";
import { ConfirmDialog } from "@/features/workflows/confirm-dialog";
import { DefinitionGraph } from "@/features/workflows/definition-graph";
import { PollingIntervalPicker } from "@/features/workflows/polling-interval-picker";
import { usePollingInterval } from "@/features/workflows/use-polling-interval";
import {
  useActivityExecutionSummaries,
  useCancelInstance,
  useDeleteInstance,
  useExportInstance,
  useWorkflowDefinition,
  useWorkflowInstance,
} from "@/lib/api/elsa";
import { useWorkflowInstanceLiveUpdates } from "@/lib/api/signalr";
import type { WorkflowStatus } from "@/lib/api/types";

type Props = { instanceId: string };

/**
 * Workflow instance viewer. Currently renders the workflow definition graph in
 * read-only mode with the instance's status header. Journal / call-stack /
 * execution drawer come in a follow-up; this is the minimum viable surface so
 * row clicks from the instance list have somewhere to land.
 */
export function InstanceViewer({ instanceId }: Props) {
  const router = useRouter();
  // Auto-refresh cadence is user-configurable; the picker persists the last
  // choice. `0` ("Off") disables polling entirely — SignalR pushes still arrive
  // (`useWorkflowInstanceLiveUpdates` below) so the UI stays responsive.
  const { ms: pollingMs, setMs: setPollingMs } = usePollingInterval();
  const refetchInterval = pollingMs > 0 ? pollingMs : undefined;

  const instance = useWorkflowInstance(instanceId, { refetchInterval });
  const definitionId = instance.data?.definitionId;
  const definition = useWorkflowDefinition(definitionId, "Latest");

  const cancel = useCancelInstance();
  const del = useDeleteInstance();
  const exportInstance = useExportInstance();
  const setSelectedActivityId = useEditorStore((s) => s.setSelectedActivityId);
  // Subscribed for the ActivityConfigSheet — opens when the user clicks a
  // canvas node directly (no journal row selected). Cleared by the sheet's
  // own close button or by selecting a journal row instead.
  const selectedActivityId = useEditorStore((s) => s.selectedActivityId);

  // Honour an `?activityId=` query param so deep links (e.g. from the
  // resilience tab's "View recent retries" affordance) pre-select the right
  // activity on the canvas. Runs once on mount per instance.
  const searchParams = useSearchParams();
  const initialActivityId = searchParams.get("activityId");
  useEffect(() => {
    if (initialActivityId) setSelectedActivityId(initialActivityId);
  }, [initialActivityId, setSelectedActivityId]);
  // The editor store is shared between the editor and viewer. Reset any
  // container-drill frames a previous editor session may have left behind so
  // the canvas always opens at the workflow root.
  const popToContainer = useEditorStore((s) => s.popToContainer);
  useEffect(() => {
    popToContainer(-1);
    return () => popToContainer(-1);
  }, [instanceId, popToContainer]);

  // Subscribe to live updates — invalidates the polled queries on the fly so
  // the journal / stats / state panes refresh without waiting for the poll tick.
  useWorkflowInstanceLiveUpdates(instanceId);

  // Cmd/Ctrl+R triggers a one-shot refetch instead of a full page reload. We
  // only swallow the keypress when the user isn't typing into an input — the
  // viewer doesn't have edit fields today but the journal copy controls
  // include focusable buttons, and we don't want to fight native behaviour.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "r") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (t && t.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      instance.refetch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [instance]);

  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  // The Journal pane fires its own request for these; this second hook reuses
  // the react-query cache (same query key) so we don't double-fetch — we just
  // need read access to the summaries for the canvas badge overlay.
  const summaries = useActivityExecutionSummaries(instanceId, { refetchInterval });
  const statsByActivityId = useMemo(
    () => aggregateStatsByActivityId(summaries.data ?? []),
    [summaries.data],
  );

  if (instance.isPending) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading instance…
      </div>
    );
  }

  if (instance.isError || !instance.data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="text-destructive size-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Couldn&apos;t load this instance.</p>
              <p className="text-muted-foreground text-xs">
                It may have been deleted or the server is unreachable.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const i = instance.data;
  const isRunning = i.status === "Running";
  // The summary endpoint returns `incidentCount`; fall back to whatever the
  // full-instance payload happens to carry (the type is loose so we narrow
  // here). 0 means "nothing to surface" — the badge stays hidden.
  const incidentCount =
    typeof (i as { incidentCount?: number }).incidentCount === "number"
      ? ((i as { incidentCount?: number }).incidentCount as number)
      : 0;

  const onCancel = async () => {
    try {
      await cancel.mutateAsync(i.id);
      toast.success("Instance cancelled.");
      setConfirm(null);
    } catch {
      toast.error("Couldn't cancel the instance.");
    }
  };

  const onDelete = async () => {
    try {
      await del.mutateAsync(i.id);
      toast.success("Instance deleted.");
      router.push("/workflows/instances");
    } catch {
      toast.error("Couldn't delete the instance.");
    }
  };

  return (
    <main className="bg-muted/30 flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to instances"
          render={<Link href="/workflows/instances" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">
            {i.name?.trim() || (
              <span className="text-muted-foreground font-mono">{i.id.slice(0, 8)}</span>
            )}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
            <StatusBadge status={i.status} />
            <span>· {i.subStatus}</span>
            <span>·</span>
            <ElapsedTime
              startedAt={i.createdAt}
              finishedAt={i.finishedAt}
              isRunning={isRunning}
            />
            <span>· created {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}</span>
            <span>· updated {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })}</span>
            {i.correlationId ? (
              <span className="font-mono">· corr {i.correlationId.slice(0, 8)}</span>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <PollingIntervalPicker
            value={pollingMs}
            onChange={setPollingMs}
            onRefreshNow={() => instance.refetch()}
            busy={instance.isFetching}
          />
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/diagnostics/structured-logs?workflowInstanceId=${i.id}`} />
            }
            title="View structured logs for this instance"
          >
            <FileText className="size-3.5" /> Logs
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await exportInstance.mutateAsync({ instanceId: i.id });
              } catch {
                toast.error("Couldn't export this instance.");
              }
            }}
            disabled={exportInstance.isPending}
            title="Download this instance as JSON"
          >
            <Download className="size-3.5" /> Export
          </Button>
          {definitionId ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/workflows/definitions/${definitionId}/edit`} />}
            >
              Open definition
            </Button>
          ) : null}
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/alterations/instances/${i.id}`} />}
              title="Open this instance in the alterations designer"
            >
              <Wand2 className="size-3.5" /> Alter
            </Button>
          ) : null}
          {isRunning ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm("cancel")}
              disabled={cancel.isPending}
            >
              <XCircle className="size-3.5" /> Cancel
            </Button>
          ) : null}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirm("delete")}
            disabled={del.isPending}
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div
        className="grid flex-1 min-h-0"
        style={{ gridTemplateColumns: "minmax(280px, 28%) 1fr" }}
      >
        <aside className="bg-background flex min-h-0 flex-col overflow-hidden border-r">
          <Tabs defaultValue="timeline" className="flex h-full min-h-0 flex-1 flex-col">
            <TabsList variant="line" className="px-2 pb-1 pt-1.5 gap-1">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="issues">
                Issues
                <IssuesBadge count={incidentCount} />
              </TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="timeline" className="min-h-0 flex-1 overflow-hidden">
              <Journal
                instanceId={i.id}
                selectedEntryId={selectedEntryId}
                onSelect={(entry) => {
                  setSelectedEntryId(entry.id);
                  setSelectedActivityId(entry.activityId);
                }}
              />
            </TabsContent>
            <TabsContent value="data" className="min-h-0 flex-1 overflow-hidden">
              <DataPane instanceId={i.id} />
            </TabsContent>
            <TabsContent value="issues" className="min-h-0 flex-1 overflow-auto">
              <IncidentsPane instanceId={i.id} />
            </TabsContent>
            <TabsContent value="details" className="min-h-0 flex-1 overflow-auto">
              <DetailsPane instanceId={i.id} />
            </TabsContent>
          </Tabs>
        </aside>
        <div className="flex min-w-0 flex-col">
          <CanvasBreadcrumb />
          <div className="min-h-0 flex-1">
            {definition.isPending ? (
              <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
                <Loader2 className="size-4 animate-spin" /> Loading workflow…
              </div>
            ) : definition.isError || !definition.data ? (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Couldn&apos;t load the workflow definition for this instance.
              </div>
            ) : (
              <CanvasErrorBoundary>
                <DefinitionGraph
                  definition={definition.data}
                  statsByActivityId={statsByActivityId}
                />
              </CanvasErrorBoundary>
            )}
          </div>
        </div>
      </div>

      {confirm === "cancel" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Cancel instance?"
          description="The instance will stop executing. Its state is preserved for inspection."
          confirmLabel="Cancel instance"
          busy={cancel.isPending}
          onConfirm={onCancel}
        />
      ) : null}
      {confirm === "delete" ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Delete instance?"
          description="All execution data for this instance will be removed permanently."
          confirmLabel="Delete"
          variant="destructive"
          busy={del.isPending}
          onConfirm={onDelete}
        />
      ) : null}

      <ExecutionDetailsSheet
        recordId={selectedEntryId}
        onOpenChange={(o) => !o && setSelectedEntryId(null)}
      />

      {/* Show the read-only activity config when a canvas node is selected and
          the journal hasn't opened an execution sheet on top of it. */}
      <ActivityConfigSheet
        activityId={selectedEntryId ? null : selectedActivityId}
        definition={definition.data}
        instanceId={i.id}
        onOpenChange={(o) => {
          if (!o) setSelectedActivityId(null);
        }}
        onSelectRecord={(recordId) => {
          setSelectedEntryId(recordId);
        }}
      />
    </main>
  );
}

function StatusBadge({ status }: { status: WorkflowStatus }) {
  if (status === "Running") {
    return <Badge className="border-sky-600 bg-sky-500 text-white">Running</Badge>;
  }
  if (status === "Finished") {
    return <Badge className="border-emerald-600 bg-emerald-500 text-white">Finished</Badge>;
  }
  if (status === "Faulted") {
    return <Badge className="border-rose-600 bg-rose-500 text-white">Faulted</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
}

/** Small badge shown next to the "Issues" tab label when the instance has incidents. */
function IssuesBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-2xs font-semibold leading-none text-white tabular-nums">
      {count}
    </span>
  );
}
