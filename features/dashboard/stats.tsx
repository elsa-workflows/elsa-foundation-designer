"use client";

import { Activity, AlertTriangle, CheckCircle2, Workflow } from "lucide-react";
import { subHours } from "date-fns";
import { useMemo } from "react";

import { useWorkflowDefinitions, useWorkflowInstances } from "@/lib/api/elsa";
import { useSession } from "@/features/auth/use-session";
import { StatCard } from "@/features/dashboard/stat-card";

export function StatTotalDefinitions() {
  const { session } = useSession();
  const q = useWorkflowDefinitions({ pageSize: 1 });
  return (
    <StatCard
      label="Workflow Definitions"
      hint="Total registered"
      icon={Workflow}
      value={q.data?.totalCount ?? null}
      loading={!!session && q.isPending}
    />
  );
}

export function StatPublished() {
  const { session } = useSession();
  const q = useWorkflowDefinitions({ pageSize: 1, versionOptions: "Published" });
  return (
    <StatCard
      label="Published"
      hint="Currently published"
      icon={CheckCircle2}
      value={q.data?.totalCount ?? null}
      loading={!!session && q.isPending}
      tone="primary"
    />
  );
}

export function StatRunning() {
  const { session } = useSession();
  const q = useWorkflowInstances({ pageSize: 1, status: "Running" });
  return (
    <StatCard
      label="Running Instances"
      hint="Live executions"
      icon={Activity}
      value={q.data?.totalCount ?? null}
      loading={!!session && q.isPending}
      tone="primary"
    />
  );
}

export function StatFailed24h() {
  const { session } = useSession();
  const since = useMemo(() => subHours(new Date(), 24).toISOString(), []);
  const q = useWorkflowInstances({
    pageSize: 1,
    subStatus: "Faulted",
    createdAtFrom: since,
  });
  return (
    <StatCard
      label="Faulted (24h)"
      hint="Failed in last day"
      icon={AlertTriangle}
      value={q.data?.totalCount ?? null}
      loading={!!session && q.isPending}
      tone={q.data && q.data.totalCount > 0 ? "destructive" : "default"}
    />
  );
}
