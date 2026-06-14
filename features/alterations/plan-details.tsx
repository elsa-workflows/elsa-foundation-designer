"use client";

import { format } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  Loader2,
  RefreshCw,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAlterationPlan,
  type AlterationJob,
  type AlterationJobStatus,
  type AlterationLogEntry,
  type AlterationLogLevel,
} from "@/lib/api/alterations";
import { useAlterationPlanLiveUpdates } from "@/lib/api/signalr";
import { PlanStatusBadge } from "@/features/alterations/plan-status-badge";

export function PlanDetails({ planId }: { planId: string }) {
  const q = useAlterationPlan(planId);
  useAlterationPlanLiveUpdates(planId);

  if (q.isPending) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="text-destructive size-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Couldn&apos;t load this alteration plan.
              </p>
              <p className="text-muted-foreground text-xs">
                Either the plan id is unknown or the Elsa server returned an
                error.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { plan, jobs } = q.data;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <Tag className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate font-mono text-sm">{plan.id}</span>
          </div>
          <PlanStatusBadge status={plan.status} />
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Clock className="size-3.5" />
            <span>Created {format(new Date(plan.createdAt), "yyyy-MM-dd HH:mm")}</span>
          </div>
          {plan.completedAt ? (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5" />
              <span>
                Completed{" "}
                {format(new Date(plan.completedAt), "yyyy-MM-dd HH:mm")}
              </span>
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw
              className={[
                "size-3.5",
                q.isFetching ? "animate-spin" : "",
              ].join(" ")}
            />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
          <Layers className="size-3.5" />
          Alterations
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {plan.alterations.length}
          </Badge>
        </h2>
        {plan.alterations.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No alterations on this plan.
          </p>
        ) : (
          <div className="space-y-2">
            {plan.alterations.map((alt, idx) => (
              <pre
                key={idx}
                className="bg-muted text-foreground/90 overflow-auto rounded-md p-3 text-xs"
              >
                {JSON.stringify(alt, null, 2)}
              </pre>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em]">
          <Loader2 className="size-3.5" />
          Jobs
          <Badge variant="secondary" className="ml-1 text-[10px]">
            {jobs.length}
          </Badge>
        </h2>
        {jobs.length === 0 ? (
          <p className="text-muted-foreground text-sm">No jobs yet.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function JobRow({ job }: { job: AlterationJob }) {
  const [open, setOpen] = useState(false);
  const logs = (job.log ?? []).slice().sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );

  return (
    <Card className="overflow-hidden py-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left"
            />
          }
        >
          {open ? (
            <ChevronDown className="text-muted-foreground size-4 shrink-0" />
          ) : (
            <ChevronRight className="text-muted-foreground size-4 shrink-0" />
          )}
          <JobStatusBadge status={job.status} />
          <Link
            href={`/workflows/instances/${job.workflowInstanceId}`}
            onClick={(e) => e.stopPropagation()}
            className="text-foreground hover:text-foreground/80 truncate font-mono text-xs underline-offset-2 hover:underline"
          >
            {job.workflowInstanceId}
          </Link>
          <div className="text-muted-foreground ml-auto flex items-center gap-3 text-xs whitespace-nowrap">
            <span>Created {format(new Date(job.createdAt), "HH:mm:ss")}</span>
            {job.completedAt ? (
              <span>
                Completed {format(new Date(job.completedAt), "HH:mm:ss")}
              </span>
            ) : null}
            <span>
              {logs.length} {logs.length === 1 ? "entry" : "entries"}
            </span>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t bg-muted/30 p-3">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                No log entries — handler may not have run yet.
              </p>
            ) : (
              <div className="grid grid-cols-[auto_auto_auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
                {logs.map((entry, idx) => (
                  <LogRow key={idx} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function LogRow({ entry }: { entry: AlterationLogEntry }) {
  return (
    <>
      <span className="text-muted-foreground">
        {format(new Date(entry.timestamp), "HH:mm:ss.SSS")}
      </span>
      <span className={logLevelClass(entry.logLevel)}>
        {entry.logLevel.toUpperCase()}
      </span>
      <span className="text-muted-foreground/80">
        {entry.eventName ?? ""}
      </span>
      <span className="text-foreground/90 whitespace-pre-wrap">
        {entry.message}
      </span>
    </>
  );
}

function logLevelClass(level: AlterationLogLevel): string {
  switch (level) {
    case "Error":
    case "Critical":
      return "text-rose-600 dark:text-rose-400";
    case "Warning":
      return "text-amber-600 dark:text-amber-400";
    case "Information":
      return "text-sky-600 dark:text-sky-400";
    case "Debug":
    case "Trace":
      return "text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function JobStatusBadge({ status }: { status: AlterationJobStatus }) {
  if (status === "Running") {
    return (
      <Badge className="border-sky-600 bg-sky-500 text-white">Running</Badge>
    );
  }
  if (status === "Completed") {
    return (
      <Badge className="border-emerald-600 bg-emerald-500 text-white">
        Completed
      </Badge>
    );
  }
  if (status === "Failed") {
    return (
      <Badge className="border-rose-600 bg-rose-500 text-white">Failed</Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}
