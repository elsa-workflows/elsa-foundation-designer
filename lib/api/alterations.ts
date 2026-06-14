"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { elsa } from "@/lib/api/client";
import {
  useWorkflowInstances,
  type InstancesQuery,
} from "@/lib/api/elsa";

// ---------------------------------------------------------------------------
// DTOs — mirror Elsa.Api.Client.Resources.Alterations.*
// ---------------------------------------------------------------------------

export type AlterationPlanStatus =
  | "Pending"
  | "Generating"
  | "Dispatching"
  | "Running"
  | "Completed"
  | "Failed";

export type AlterationJobStatus =
  | "Pending"
  | "Running"
  | "Completed"
  | "Failed";

export type AlterationLogLevel =
  | "Trace"
  | "Debug"
  | "Information"
  | "Warning"
  | "Error"
  | "Critical"
  | "None";

export type AlterationLogEntry = {
  message: string;
  logLevel: AlterationLogLevel;
  timestamp: string;
  eventName?: string | null;
};

export type AlterationJob = {
  id: string;
  planId: string;
  workflowInstanceId: string;
  status: AlterationJobStatus;
  log?: AlterationLogEntry[] | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

/**
 * Mirror of Elsa's AlterationWorkflowInstanceFilter — used both by the
 * staging-submit flow (which only sends ids) and by the instances list's
 * "apply to all matches" bulk action (which forwards the live list filter).
 *
 * Field names match the server's `AlterationWorkflowInstanceFilter`.
 */
export type AlterationWorkflowInstanceFilter = {
  emptyFilterSelectsAll?: boolean;
  workflowInstanceIds?: string[];
  correlationIds?: string[];
  names?: string[];
  searchTerm?: string;
  timestampFilters?: import("@/lib/api/types").TimestampFilter[];
  definitionIds?: string[];
  definitionVersionIds?: string[];
  hasIncidents?: boolean;
  isSystem?: boolean;
  statuses?: import("@/lib/api/types").WorkflowStatus[];
  subStatuses?: import("@/lib/api/types").WorkflowSubStatus[];
};

export type AlterationPlan = {
  id: string;
  alterations: unknown[];
  workflowInstanceFilter: AlterationWorkflowInstanceFilter;
  status: AlterationPlanStatus;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

export type GetAlterationPlanResponse = {
  plan: AlterationPlan;
  jobs: AlterationJob[];
};

export type SubmitAlterationsRequest = {
  id?: string;
  alterations: Record<string, unknown>[];
  filter: AlterationWorkflowInstanceFilter;
};

export type SubmitAlterationsResponse = { planId: string };

export type DryRunResponse = { workflowInstanceIds: string[] };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Definition id of the system workflow the server uses to execute plans. */
export const ALTERATION_PLAN_DEFINITION_ID = "Elsa.Alterations.ExecuteAlterationPlan";

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export const alterationKeys = {
  plan: (planId: string | undefined) => ["alteration-plan", planId] as const,
};

/**
 * Fetch one alteration plan + its jobs. The plan's id equals the planId the
 * submit dialog returned. Backend route mirrors IAlterationsApi.GetAsync.
 */
export function useAlterationPlan(planId: string | undefined) {
  return useQuery({
    queryKey: alterationKeys.plan(planId),
    enabled: !!planId,
    queryFn: () =>
      elsa.get(`alterations/${planId}`).json<GetAlterationPlanResponse>(),
    placeholderData: (prev) => prev,
  });
}

/**
 * Plans index. The Elsa server materialises each plan as a workflow instance
 * of the system definition `Elsa.Alterations.ExecuteAlterationPlan`, with the
 * planId stored as the instance's correlationId. So the plans list is just a
 * filtered workflow-instances query.
 */
export function useAlterationPlans(
  params: Omit<InstancesQuery, "definitionId" | "isSystem"> = {},
) {
  return useWorkflowInstances({
    ...params,
    definitionId: ALTERATION_PLAN_DEFINITION_ID,
    isSystem: true,
    orderBy: params.orderBy ?? "Created",
    orderDirection: params.orderDirection ?? "Descending",
  });
}

/** Running, user-facing workflow instances available to alter. */
export function useAlterableInstances(
  params: Omit<InstancesQuery, "isSystem" | "status"> = {},
) {
  return useWorkflowInstances({
    ...params,
    status: "Running",
    isSystem: false,
    orderBy: params.orderBy ?? "Created",
    orderDirection: params.orderDirection ?? "Descending",
  });
}

/** POST /alterations/submit — kicks off the plan asynchronously. */
export function useSubmitAlterations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: SubmitAlterationsRequest) =>
      elsa
        .post("alterations/submit", { json: request })
        .json<SubmitAlterationsResponse>(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workflow-instances"] });
    },
  });
}

/** POST /alterations/dry-run — returns the instance ids the filter selects. */
export function useDryRunAlterations() {
  return useMutation({
    mutationFn: (filter: AlterationWorkflowInstanceFilter) =>
      elsa
        .post("alterations/dry-run", { json: filter })
        .json<DryRunResponse>(),
  });
}
