"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { elsa } from "@/lib/api/client";
import { downloadBlob, filenameFromContentDisposition } from "@/lib/api/download";
import type {
  ActivityDescriptor,
  ActivityExecutionRecord,
  ActivityExecutionRecordSummary,
  BulkDeleteWorkflowDefinitionsResponse,
  CommitStrategyDescriptor,
  ExpressionDescriptor,
  JournalFilter,
  Label,
  ResilienceStrategyDescriptor,
  BulkPublishWorkflowDefinitionsResponse,
  BulkRetractWorkflowDefinitionsResponse,
  ExecuteWorkflowDefinitionRequest,
  ExecuteWorkflowResult,
  GetIsNameUniqueResponse,
  ImportFilesResponse,
  ListActivityDescriptorsResponse,
  ListResponse,
  OrderByWorkflowDefinition,
  OrderDirection,
  PagedListResponse,
  SaveWorkflowDefinitionRequest,
  SaveWorkflowDefinitionResponse,
  StorageDriverDescriptor,
  TimestampFilter,
  UpdateConsumingWorkflowReferencesResponse,
  VariableTypeDescriptor,
  VersionOptions,
  WorkflowDefinition,
  WorkflowDefinitionSummary,
  WorkflowDefinitionVersion,
  WorkflowExecutionLogRecord,
  WorkflowInstanceSummary,
  WorkflowSubStatus,
} from "@/lib/api/types";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const wfKeys = {
  all: ["workflow-definitions"] as const,
  list: (params: DefinitionsQuery) => [...wfKeys.all, "list", params] as const,
  byDefinition: (definitionId: string | undefined, versionOptions: VersionOptions) =>
    [...wfKeys.all, "by-definition", definitionId, versionOptions] as const,
  versions: (definitionId: string | undefined) =>
    [...wfKeys.all, "versions", definitionId] as const,
  isNameUnique: (name: string, definitionId: string | undefined) =>
    [...wfKeys.all, "is-name-unique", name, definitionId] as const,
};

export const descriptorKeys = {
  activities: ["activity-descriptors"] as const,
  storageDrivers: ["storage-drivers"] as const,
  variableTypes: ["variable-types"] as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type InstancesQuery = {
  status?: "Running" | "Finished" | "Cancelled" | "Faulted";
  subStatus?: WorkflowSubStatus;
  pageSize?: number;
  page?: number;
  searchTerm?: string;
  correlationId?: string;
  definitionId?: string;
  /**
   * Multi-select equivalent of `definitionId`. The Elsa server's
   * `ListWorkflowInstancesRequest` reads BOTH — `DefinitionIds` is preferred
   * when non-empty. Repeated query parameters are emitted by
   * `buildSearchParams`.
   */
  definitionIds?: string[];
  isSystem?: boolean;
  hasIncidents?: boolean;
  // Elsa server enum values — keep these in sync with
  // `OrderByWorkflowInstance` on the server. Note: it's `Created` (not
  // `CreatedAt`) and `Finished` (not `FinishedAt`); sending a value outside
  // this set makes the endpoint 4xx.
  orderBy?: "Created" | "UpdatedAt" | "Finished" | "Name";
  orderDirection?: OrderDirection;
  createdAtFrom?: string;
  /**
   * Time-range filters scoped to `CreatedAt` / `UpdatedAt` / `FinishedAt`. When
   * non-empty, the hook switches the underlying request to POST so the
   * collection serialises cleanly as JSON instead of query-string keys.
   */
  timestampFilters?: TimestampFilter[];
};

export type DefinitionsQuery = {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  isSystem?: boolean;
  orderBy?: OrderByWorkflowDefinition;
  orderDirection?: OrderDirection;
  versionOptions?: VersionOptions;
  materializer?: string;
  labels?: string[];
};

function buildSearchParams(input: Record<string, unknown>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      for (const item of v) sp.append(k, String(item));
    } else {
      sp.set(k, String(v));
    }
  }
  return sp;
}

// ---------------------------------------------------------------------------
// Workflow-definition queries
// ---------------------------------------------------------------------------

export function useWorkflowDefinitions(params: DefinitionsQuery = {}) {
  return useQuery({
    queryKey: wfKeys.list(params),
    queryFn: () =>
      elsa
        .get("workflow-definitions", { searchParams: buildSearchParams(params) })
        .json<PagedListResponse<WorkflowDefinitionSummary>>(),
    placeholderData: (prev) => prev,
  });
}

export function useWorkflowDefinition(
  definitionId: string | undefined,
  versionOptions: VersionOptions = "Latest",
) {
  return useQuery({
    queryKey: wfKeys.byDefinition(definitionId, versionOptions),
    enabled: !!definitionId,
    queryFn: () =>
      elsa
        .get(`workflow-definitions/by-definition-id/${definitionId}`, {
          searchParams: buildSearchParams({ versionOptions }),
        })
        .json<WorkflowDefinition>(),
  });
}

/** Read all versions of a single workflow definition (newest first). */
export function useWorkflowDefinitionVersions(definitionId: string | undefined) {
  return useQuery({
    queryKey: wfKeys.versions(definitionId),
    enabled: !!definitionId,
    queryFn: async () => {
      const all = await elsa
        .get("workflow-definitions", {
          searchParams: buildSearchParams({
            definitionIds: [definitionId!],
            versionOptions: "AllVersions",
            orderBy: "Version",
            orderDirection: "Descending",
            pageSize: 200,
          }),
        })
        .json<PagedListResponse<WorkflowDefinitionSummary>>();
      return all;
    },
  });
}

/**
 * Probe the backend for the first unused "Workflow N" name. Mirrors the
 * Blazor designer's GenerateUniqueNameAsync so a new definition opens with
 * a sensible default in the name field. Any probe failure short-circuits
 * to the current candidate; the submit-time validator catches collisions.
 */
export async function generateUniqueDefinitionName(): Promise<string> {
  const maxAttempts = 100;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const name = `Workflow ${attempt}`;
    try {
      const res = await elsa
        .get("workflow-definitions/validation/is-name-unique", {
          searchParams: buildSearchParams({ name }),
        })
        .json<GetIsNameUniqueResponse>();
      if (res.isUnique) return name;
    } catch {
      return name;
    }
  }
  return `Workflow ${Date.now()}`;
}

/**
 * Live-check whether a workflow name is unique. Skipped when `name` is empty.
 * `definitionId` is the workflow being edited (excluded from the check).
 */
export function useIsNameUnique(name: string, definitionId?: string) {
  const trimmed = name.trim();
  return useQuery({
    queryKey: wfKeys.isNameUnique(trimmed, definitionId),
    enabled: trimmed.length > 0,
    queryFn: () =>
      elsa
        .get("workflow-definitions/validation/is-name-unique", {
          searchParams: buildSearchParams({ name: trimmed, definitionId }),
        })
        .json<GetIsNameUniqueResponse>(),
    staleTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Workflow-definition mutations
// ---------------------------------------------------------------------------

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: wfKeys.all });
}

/**
 * Save a workflow definition. The server returns the persisted definition
 * with its new version metadata. Used for both create (no id yet) and update.
 */
export function useSaveWorkflowDefinition() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (request: SaveWorkflowDefinitionRequest) =>
      elsa
        .post("workflow-definitions", { json: request })
        .json<SaveWorkflowDefinitionResponse>(),
    onSuccess: () => invalidate(),
  });
}

/** Convenience: create a brand-new definition with just a name + description. */
export function useCreateDefinition() {
  const save = useSaveWorkflowDefinition();
  return {
    ...save,
    mutateAsync: async (input: {
      name: string;
      description?: string;
      /**
       * Optional root activity. When omitted the server picks its default
       * (typically Sequence). Callers that want to control the canvas type
       * pass a fresh root built via `makeFlowchart` / `makeSequence` /
       * `makeStateMachine`.
       */
      root?: import("@/lib/api/types").ActivityJson;
    }) =>
      save.mutateAsync({
        model: {
          definitionId: crypto.randomUUID(),
          name: input.name,
          description: input.description ?? null,
          ...(input.root ? { root: input.root } : {}),
        },
      }),
  };
}

export function useDeleteDefinition() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (definitionId: string) =>
      elsa.delete(`workflow-definitions/${definitionId}`).then(() => undefined),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteDefinitionVersion() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      elsa.delete(`workflow-definition-versions/${id}`).then(() => undefined),
    onSuccess: () => invalidate(),
  });
}

export function usePublishDefinition() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (definitionId: string) =>
      elsa
        .post(`workflow-definitions/${definitionId}/publish`, { json: {} })
        .json<SaveWorkflowDefinitionResponse>(),
    onSuccess: () => invalidate(),
  });
}

export function useRetractDefinition() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (definitionId: string) =>
      elsa
        .post(`workflow-definitions/${definitionId}/retract`, { json: {} })
        .json<WorkflowDefinition>(),
    onSuccess: () => invalidate(),
  });
}

export function useRevertDefinitionVersion() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ definitionId, version }: { definitionId: string; version: number }) =>
      elsa
        .post(`workflow-definitions/${definitionId}/revert/${version}`, { json: {} })
        .json<WorkflowDefinitionSummary>(),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateConsumingReferences() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (definitionId: string) =>
      elsa
        .post(`workflow-definitions/${definitionId}/update-references`, { json: {} })
        .json<UpdateConsumingWorkflowReferencesResponse>(),
    onSuccess: () => invalidate(),
  });
}

export function useBulkDeleteDefinitions() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (definitionIds: string[]) =>
      elsa
        .post("bulk-actions/delete/workflow-definitions/by-definition-id", {
          json: { definitionIds },
        })
        .json<BulkDeleteWorkflowDefinitionsResponse>(),
    onSuccess: () => invalidate(),
  });
}

export function useBulkDeleteDefinitionVersions() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (versions: WorkflowDefinitionVersion[]) =>
      elsa
        .post("bulk-actions/delete/workflow-definitions/by-id", {
          json: { ids: versions.map((v) => v.id) },
        })
        .json<BulkDeleteWorkflowDefinitionsResponse>(),
    onSuccess: () => invalidate(),
  });
}

export function useBulkPublishDefinitions() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (definitionIds: string[]) =>
      elsa
        .post("bulk-actions/publish/workflow-definitions/by-definition-ids", {
          json: { definitionIds },
        })
        .json<BulkPublishWorkflowDefinitionsResponse>(),
    onSuccess: () => invalidate(),
  });
}

export function useBulkRetractDefinitions() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (definitionIds: string[]) =>
      elsa
        .post("bulk-actions/retract/workflow-definitions/by-definition-ids", {
          json: { definitionIds },
        })
        .json<BulkRetractWorkflowDefinitionsResponse>(),
    onSuccess: () => invalidate(),
  });
}

/**
 * Single-definition export. Streams the response and triggers a browser
 * download. Returns `void` because the file has been delivered to the user.
 */
export function useExportDefinition() {
  return useMutation({
    mutationFn: async (input: {
      definitionId: string;
      versionOptions?: VersionOptions;
      includeConsumingWorkflows?: boolean;
      filename?: string;
    }) => {
      const res = await elsa.get(`workflow-definitions/${input.definitionId}/export`, {
        searchParams: buildSearchParams({
          versionOptions: input.versionOptions,
          includeConsumingWorkflows: input.includeConsumingWorkflows ?? false,
        }),
      });
      const blob = await res.blob();
      const name =
        input.filename ??
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        `workflow-${input.definitionId}.json`;
      downloadBlob(blob, name);
    },
  });
}

/** Bulk export → ZIP. Triggers a browser download. */
export function useBulkExportDefinitions() {
  return useMutation({
    mutationFn: async (input: { ids: string[]; includeConsumingWorkflows?: boolean }) => {
      const res = await elsa.post("bulk-actions/export/workflow-definitions", {
        json: {
          ids: input.ids,
          includeConsumingWorkflows: input.includeConsumingWorkflows ?? false,
        },
      });
      const blob = await res.blob();
      const name =
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        `workflows-${new Date().toISOString().slice(0, 10)}.zip`;
      downloadBlob(blob, name);
    },
  });
}

/** Multipart import. Accepts JSON or ZIP files. */
export function useImportFiles() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      return elsa
        .post("workflow-definitions/import-files", { body: form })
        .json<ImportFilesResponse>();
    },
    onSuccess: () => invalidate(),
  });
}

export function useExecuteDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      definitionId,
      request,
    }: {
      definitionId: string;
      request?: ExecuteWorkflowDefinitionRequest;
    }) =>
      elsa
        .post(`workflow-definitions/${definitionId}/execute`, {
          json: request ?? {},
        })
        .json<ExecuteWorkflowResult>(),
    onSuccess: (res) => {
      // A new workflow instance was just created (when cannotStart is false).
      // Anything subscribed to ["workflow-instances", …] — the dashboard
      // chart, timeline, recent-instances, the instances page — should
      // pick up the fresh row on its next render.
      if (!res.cannotStart) {
        qc.invalidateQueries({ queryKey: ["workflow-instances"] });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Descriptor queries (activities, storage drivers, variable types)
// ---------------------------------------------------------------------------

export function useActivityDescriptors() {
  return useQuery({
    queryKey: descriptorKeys.activities,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/activities")
        .json<ListActivityDescriptorsResponse>();
      return res.items as ActivityDescriptor[];
    },
    staleTime: 60_000,
  });
}

/**
 * Catalog of expression syntaxes the backend advertises. Each descriptor's
 * `properties.MonacoLanguage` decides whether the cell renders as a Monaco
 * editor (and which grammar to load). Caches for 60 s.
 */
export function useExpressionDescriptors() {
  return useQuery({
    queryKey: ["expression-descriptors"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/expression-descriptors")
        .json<ListResponse<ExpressionDescriptor>>();
      return res.items;
    },
  });
}

/** Incident-strategy catalog for the workflow-level Settings section. */
export function useIncidentStrategies() {
  return useQuery({
    queryKey: ["incident-strategies"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/incident-strategies")
        .json<ListResponse<{ typeName: string; displayName: string; description?: string | null }>>();
      return res.items;
    },
  });
}

/** Workflow-activation strategy catalog (e.g. "always start new", "correlate"). */
export function useActivationStrategies() {
  return useQuery({
    queryKey: ["activation-strategies"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/workflow-activation-strategies")
        .json<ListResponse<{ typeName: string; displayName: string; description?: string | null }>>();
      return res.items;
    },
  });
}

/** Log-persistence strategy catalog used at workflow and activity scopes. */
export function useLogPersistenceStrategies() {
  return useQuery({
    queryKey: ["log-persistence-strategies"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/log-persistence-strategies")
        .json<ListResponse<{ typeName: string; displayName: string; description?: string | null }>>();
      return res.items;
    },
  });
}

/** Workflow-level commit strategies (distinct catalog from activity-level). */
export function useWorkflowCommitStrategies() {
  return useQuery({
    queryKey: ["commit-strategies", "workflows"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/commit-strategies/workflows")
        .json<ListResponse<CommitStrategyDescriptor>>();
      return res.items;
    },
  });
}

/** All workflow-definition labels. Long staleTime — rarely changes. */
export function useLabels() {
  return useQuery({
    queryKey: ["labels"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa.get("labels").json<PagedListResponse<Label>>();
      return res.items;
    },
  });
}

/** Activity-level commit strategies catalog. Long staleTime — rarely changes. */
export function useActivityCommitStrategies() {
  return useQuery({
    queryKey: ["commit-strategies", "activities"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/commit-strategies/activities")
        .json<ListResponse<CommitStrategyDescriptor>>();
      return res.items;
    },
  });
}

/** Resilience strategies catalog. Long staleTime — rarely changes. */
export function useResilienceStrategies() {
  return useQuery({
    queryKey: ["resilience-strategies"],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await elsa
        .get("resilience/strategies")
        .json<ListResponse<ResilienceStrategyDescriptor>>();
      return res.items;
    },
  });
}

export function useStorageDrivers() {
  return useQuery({
    queryKey: descriptorKeys.storageDrivers,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/storage-drivers")
        .json<ListResponse<StorageDriverDescriptor>>();
      return res.items;
    },
    staleTime: 60_000,
  });
}

export function useVariableTypes() {
  return useQuery({
    queryKey: descriptorKeys.variableTypes,
    queryFn: async () => {
      const res = await elsa
        .get("descriptors/variables")
        .json<ListResponse<VariableTypeDescriptor>>();
      return res.items;
    },
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Workflow-instances (unchanged surface)
// ---------------------------------------------------------------------------

export function useWorkflowInstances(
  params: InstancesQuery = {},
  options: { refetchInterval?: number } = {},
) {
  const hasTimestampFilters =
    Array.isArray(params.timestampFilters) && params.timestampFilters.length > 0;
  return useQuery({
    queryKey: ["workflow-instances", params],
    queryFn: () => {
      // The Elsa endpoint accepts both GET (query-string) and POST (JSON body).
      // For simple filters GET is cheaper; once we have collection-of-objects
      // filters (timestamp ranges) the cleanest serialisation is a POST body.
      if (hasTimestampFilters) {
        return elsa
          .post("workflow-instances", { json: params })
          .json<PagedListResponse<WorkflowInstanceSummary>>();
      }
      return elsa
        .get("workflow-instances", { searchParams: buildSearchParams(params) })
        .json<PagedListResponse<WorkflowInstanceSummary>>();
    },
    placeholderData: (prev) => prev,
    refetchInterval: options.refetchInterval,
  });
}

/**
 * Fetch a single workflow instance by id, including embedded execution state.
 * Polled by the viewer page (default 5s).
 */
export function useWorkflowInstance(
  instanceId: string | undefined,
  options: { refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: ["workflow-instance", instanceId],
    enabled: !!instanceId,
    refetchInterval: options.refetchInterval,
    queryFn: () =>
      elsa.get(`workflow-instances/${instanceId}`).json<WorkflowInstanceSummary & Record<string, unknown>>(),
  });
}

/** Cancel a single running workflow instance. */
export function useCancelInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) =>
      elsa.post(`workflow-instances/${instanceId}/cancel`, { json: {} }).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-instances"] }),
  });
}

/** Delete a single workflow instance. */
export function useDeleteInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) =>
      elsa.delete(`workflow-instances/${instanceId}`).then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-instances"] }),
  });
}

/** Bulk cancel multiple instances. Backend route: bulk-actions/cancel/workflow-instances. */
export function useBulkCancelInstances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      elsa
        .post("bulk-actions/cancel/workflow-instances", { json: { ids } })
        .then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-instances"] }),
  });
}

/**
 * Cancel every running instance of a workflow definition (all versions by
 * default). Backend route: bulk-actions/cancel/workflow-instances accepts a
 * `definitionId` + `versionOptions` payload.
 */
export function useCancelInstancesByDefinition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { definitionId: string; versionOptions?: VersionOptions }) =>
      elsa
        .post("bulk-actions/cancel/workflow-instances", {
          json: {
            definitionId: input.definitionId,
            versionOptions: input.versionOptions ?? "All",
          },
        })
        .json<{ cancelled: number }>(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-instances"] }),
  });
}

/**
 * List activity execution summaries for an instance — the journal feed. Pass
 * `activityNodeId` to scope to a single activity; omit it to get every entry.
 * Polled by the viewer (default 5s).
 */
export function useActivityExecutionSummaries(
  workflowInstanceId: string | undefined,
  options: { activityNodeId?: string; refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: [
      "activity-execution-summaries",
      workflowInstanceId,
      options.activityNodeId,
    ],
    enabled: !!workflowInstanceId,
    refetchInterval: options.refetchInterval,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = buildSearchParams({
        workflowInstanceId,
        activityNodeId: options.activityNodeId,
      });
      const res = await elsa
        .get("activity-execution-summaries/list", { searchParams: params })
        .json<ListResponse<ActivityExecutionRecordSummary>>();
      return res.items;
    },
  });
}

/**
 * Workflow execution log feed — the full per-instance event stream including
 * workflow lifecycle events (`Workflow Started`, `Workflow Suspended`,
 * `Workflow Faulted`, …) alongside activity events. When a `filter` is supplied
 * the hook POSTs to `/workflow-instances/{id}/journal` (mirrors Blazor's
 * `GetFilteredJournalAsync`); without one it falls back to the GET variant.
 *
 * The journal can grow large; default `pageSize` is 200 — bump it when the UI
 * needs more, or paginate manually via the response's `totalCount`.
 */
export function useWorkflowExecutionLog(
  workflowInstanceId: string | undefined,
  options: {
    filter?: JournalFilter;
    page?: number;
    pageSize?: number;
    refetchInterval?: number;
  } = {},
) {
  const { filter, page, pageSize = 200, refetchInterval } = options;
  const hasFilter = !!filter && (
    (filter.activityIds?.length ?? 0) > 0 ||
    (filter.activityNodeIds?.length ?? 0) > 0 ||
    (filter.excludedActivityTypes?.length ?? 0) > 0 ||
    (filter.eventNames?.length ?? 0) > 0
  );
  return useQuery({
    queryKey: ["workflow-execution-log", workflowInstanceId, filter, page, pageSize],
    enabled: !!workflowInstanceId,
    refetchInterval,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (hasFilter) {
        return elsa
          .post(`workflow-instances/${workflowInstanceId}/journal`, {
            json: { filter, page, pageSize },
          })
          .json<{ items: WorkflowExecutionLogRecord[]; totalCount: number }>();
      }
      return elsa
        .get(`workflow-instances/${workflowInstanceId}/journal`, {
          searchParams: buildSearchParams({ page, pageSize }),
        })
        .json<{ items: WorkflowExecutionLogRecord[]; totalCount: number }>();
    },
  });
}

/**
 * Run a single activity in isolation. Backend endpoint shape:
 *   POST /tests/activities/{typeName}
 *   body: { workflowDefinitionId, activity }
 * Returns status / activityState / outcomes / output / fault. Used by the
 * Tests tab to mirror Blazor's `ITestsApi.TestActivityAsync()`.
 */
export function useTestActivity() {
  return useMutation({
    mutationFn: async (input: {
      definitionId: string;
      activity: { type: string; [key: string]: unknown };
    }) => {
      const typeName = encodeURIComponent(input.activity.type);
      const res = await elsa
        .post(`tests/activities/${typeName}`, {
          json: {
            workflowDefinitionId: input.definitionId,
            activity: input.activity,
          },
        })
        .json<{
          status?: string;
          activityState?: Record<string, unknown>;
          outcomes?: string[];
          output?: Record<string, unknown>;
          fault?: { type?: string; message?: string; stackTrace?: string };
        }>();
      return res;
    },
  });
}

/**
 * Live workflow instance state — variables / inputs / outputs / incidents /
 * bookmarks. Projects from the main instance response (`GET /workflow-instances/{id}`)
 * whose `workflowState` blob holds everything except resolved variables, plus
 * the dedicated `/variables` endpoint for those (mirrors Blazor's
 * `RemoteWorkflowInstanceService.GetVariablesAsync`).
 *
 * No `/state` route exists on the server — the original implementation hit
 * one and silently received nothing.
 */
export function useWorkflowInstanceState(
  instanceId: string | undefined,
  options: { refetchInterval?: number } = {},
) {
  const instance = useWorkflowInstance(instanceId, options);
  const variables = useWorkflowInstanceVariables(instanceId, options);
  const data = useMemo(() => {
    if (!instance.data) return undefined;
    const state =
      ((instance.data as { workflowState?: Record<string, unknown> }).workflowState ??
        {}) as {
        bookmarks?: WorkflowStateBookmark[];
        incidents?: WorkflowStateIncident[];
        input?: Record<string, unknown> | null;
        output?: Record<string, unknown> | null;
        properties?: Record<string, unknown> | null;
      };
    const variablesMap: Record<string, unknown> = {};
    for (const v of variables.data?.items ?? []) variablesMap[v.name] = v.value;
    return {
      variables: variablesMap,
      input: state.input ?? null,
      output: state.output ?? null,
      incidents: state.incidents ?? [],
      bookmarks: state.bookmarks ?? [],
      properties: state.properties ?? null,
    };
  }, [instance.data, variables.data]);
  return {
    data,
    isPending: instance.isPending,
    isError: instance.isError,
    isFetching: instance.isFetching,
    refetch: instance.refetch,
  };
}

/** Single entry returned by `GET /workflow-instances/{id}/variables`. */
export type ResolvedVariable = {
  id: string;
  name: string;
  value: unknown;
};

/** Shape of an incident entry inside `workflowState.incidents`. */
export type WorkflowStateIncident = {
  activityId: string;
  activityNodeId: string;
  activityType: string;
  message: string;
  exception?: {
    type?: string;
    message?: string;
    stackTrace?: string;
    innerException?: unknown;
  } | null;
  timestamp: string;
};

/** Shape of a bookmark entry inside `workflowState.bookmarks`. */
export type WorkflowStateBookmark = {
  id: string;
  name: string;
  hash: string;
  activityNodeId: string;
  activityInstanceId: string;
  payload?: unknown;
  autoBurn?: boolean;
  callbackMethodName?: string | null;
  metadata?: Record<string, string> | null;
};

/**
 * Resolved variable values for a workflow instance. Mirrors Blazor's
 * `IWorkflowInstanceService.GetVariablesAsync` (`GET /workflow-instances/{id}/variables`).
 */
export function useWorkflowInstanceVariables(
  instanceId: string | undefined,
  options: { refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: ["workflow-instance-variables", instanceId],
    enabled: !!instanceId,
    refetchInterval: options.refetchInterval,
    placeholderData: (prev) => prev,
    queryFn: () =>
      elsa
        .get(`workflow-instances/${instanceId}/variables`)
        .json<ListResponse<ResolvedVariable>>(),
  });
}

/** Activity-execution call stack from the runtime. */
export function useActivityCallStack(activityExecutionId: string | undefined) {
  return useQuery({
    queryKey: ["activity-execution-call-stack", activityExecutionId],
    enabled: !!activityExecutionId,
    queryFn: () =>
      elsa
        .get(`activity-executions/${activityExecutionId}/call-stack`)
        .json<{
          items: Array<{
            activityExecutionId: string;
            activityId: string;
            activityNodeId: string;
            activityType: string;
            activityName?: string | null;
            startedAt?: string;
            completedAt?: string | null;
            status?: string;
            workflowInstanceId?: string;
          }>;
        }>(),
  });
}

/** Resume a suspended instance (no-op when the backend doesn't support it). */
export function useResumeInstance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) =>
      elsa
        .post(`workflow-instances/${instanceId}/resume`, { json: {} })
        .then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-instances"] }),
  });
}

/** Fetch a full activity-execution record by id (inputs/outputs/exception). */
export function useActivityExecutionRecord(recordId: string | undefined | null) {
  return useQuery({
    queryKey: ["activity-execution-record", recordId],
    enabled: !!recordId,
    queryFn: () =>
      elsa.get(`activity-executions/${recordId}`).json<ActivityExecutionRecord>(),
  });
}

/** A single retry attempt recorded by Elsa's resilience module. */
export type RetryAttemptRecord = {
  id: string;
  activityInstanceId: string;
  activityId: string;
  workflowInstanceId: string;
  attemptNumber: number;
  /** ISO-8601 duration ("PT2S") on the wire; rendered as-is. */
  retryDelay: string;
  details?: Record<string, string> | null;
};

/**
 * Retry attempts recorded by the resilience module for a single activity
 * execution (passes the execution record id as `activityInstanceId`, which
 * is what Elsa's `IRetryAttemptReader` expects).
 *
 * Returns `null` when the backend doesn't have the resilience module wired
 * (404). UI gates the section on a non-empty `items[]`.
 */
export function useActivityExecutionRetries(
  activityInstanceId: string | undefined | null,
) {
  return useQuery({
    queryKey: ["activity-execution-retries", activityInstanceId],
    enabled: !!activityInstanceId,
    queryFn: async () => {
      const res = await elsa.get(`resilience/retries/${activityInstanceId}`, {
        throwHttpErrors: false,
      });
      if (res.status === 404) return { items: [] as RetryAttemptRecord[], totalCount: 0 };
      if (!res.ok) throw new Error(`Retries request failed: ${res.status}`);
      return res.json<PagedListResponse<RetryAttemptRecord>>();
    },
  });
}

/** Bulk delete multiple instances. */
export function useBulkDeleteInstances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) =>
      elsa
        .post("bulk-actions/delete/workflow-instances", { json: { ids } })
        .then(() => undefined),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-instances"] }),
  });
}

/**
 * Download a single workflow instance's persisted state as JSON. Streams the
 * body and pushes it through the browser's downloader — same pattern as
 * `useExportDefinition`. The server route is `GET /workflow-instances/{id}/export`.
 */
export function useExportInstance() {
  return useMutation({
    mutationFn: async (input: { instanceId: string; filename?: string }) => {
      const res = await elsa.get(`workflow-instances/${input.instanceId}/export`);
      const blob = await res.blob();
      const name =
        input.filename ??
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        `instance-${input.instanceId}.json`;
      downloadBlob(blob, name);
    },
  });
}

/**
 * Bulk-export selected instances as a ZIP archive. Backend route mirrors
 * Blazor's `IWorkflowInstancesApi.BulkExportAsync` — `POST /bulk-actions/export/workflow-instances`
 * with the instance ids in the body.
 */
export function useBulkExportInstances() {
  return useMutation({
    mutationFn: async (input: { ids: string[] }) => {
      const res = await elsa.post("bulk-actions/export/workflow-instances", {
        json: { ids: input.ids },
      });
      const blob = await res.blob();
      const name =
        filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
        `instances-${new Date().toISOString().slice(0, 10)}.zip`;
      downloadBlob(blob, name);
    },
  });
}

/**
 * Multipart import of one or more instance JSON or ZIP files. Mirrors
 * `useImportFiles` for definitions but targets `POST /workflow-instances/import-files`.
 * Server returns the imported instance ids.
 */
export function useImportInstanceFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      const form = new FormData();
      for (const f of files) form.append("files", f, f.name);
      return elsa
        .post("workflow-instances/import-files", { body: form })
        .json<{ count?: number; imported?: number; instanceIds?: string[] } & Record<string, unknown>>();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workflow-instances"] }),
  });
}
