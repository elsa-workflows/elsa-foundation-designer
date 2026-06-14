/**
 * Minimal hand-typed Elsa API surface.
 * `pnpm gen:api` will replace `lib/api/generated/elsa.d.ts` with full types
 * generated from the live swagger; until then we keep narrow types here so the
 * dashboard / workflow-definitions pages compile without a server running.
 */

// --- shared ----------------------------------------------------------------

export type PagedListResponse<T> = {
  items: T[];
  totalCount: number;
};

/** Elsa's generic `ListResponse<T>` envelope. */
export type ListResponse<T> = {
  items: T[];
  count: number;
};

export type Link = {
  href: string;
  rel: string;
  method: string;
};

/** Field validation errors keyed by property name (Elsa's `ValidationErrors`). */
export type ValidationErrors = Record<string, string[]>;

// --- workflow definitions --------------------------------------------------

export type OrderByWorkflowDefinition = "Created" | "Name" | "Version";

/** Mirrors Elsa's `TimestampFilterOperator` enum. */
export type TimestampFilterOperator =
  | "Is"
  | "IsNot"
  | "LessThan"
  | "GreaterThan"
  | "LessThanOrEqual"
  | "GreaterThanOrEqual";

/**
 * Filter row for time-range queries on the workflow instances list.
 * Mirrors the .NET `TimestampFilter` model — the server whitelists `column`
 * to `CreatedAt` / `UpdatedAt` / `FinishedAt`.
 */
export type TimestampFilter = {
  column: "CreatedAt" | "UpdatedAt" | "FinishedAt";
  operator: TimestampFilterOperator;
  /** ISO-8601 timestamp string. */
  timestamp: string;
};
export type OrderDirection = "Ascending" | "Descending";

/**
 * Elsa's VersionOptions is serialized as a single string by the
 * VersionOptionsJsonConverter. Common values are listed; arbitrary numeric
 * strings select a specific version.
 */
export type VersionOptions =
  | "Latest"
  | "Published"
  | "LatestOrPublished"
  | "LatestAndPublished"
  | "Draft"
  | "AllVersions"
  | (string & {});

export type WorkflowDefinitionSummary = {
  id: string;
  definitionId: string;
  tenantId?: string | null;
  name: string;
  description?: string | null;
  version: number;
  isLatest: boolean;
  isPublished: boolean;
  createdAt: string;
  materializerName: string;
  isMaterializerAvailable: boolean;
};

export type WorkflowOptions = {
  activationStrategyType?: string | null;
  usableAsActivity?: boolean | null;
  autoUpdateConsumingWorkflows?: boolean;
  activityCategory?: string | null;
  incidentStrategyType?: string | null;
  commitStrategyName?: string | null;
  usePersistentVariables?: boolean | null;
  logPersistenceMode?: string | null;
};

export type VariableDefinition = {
  id: string;
  name: string;
  typeName: string;
  isArray?: boolean;
  value?: string | null;
  storageDriverTypeName?: string | null;
};

export type ArgumentDefinition = {
  type: string;
  isArray?: boolean;
  name: string;
  displayName: string;
  description: string;
  category: string;
};

export type InputDefinition = ArgumentDefinition & {
  uiHint: string;
  storageDriverType?: string | null;
  defaultValue?: unknown;
  defaultSyntax?: string | null;
  isReadOnly?: boolean | null;
};

export type OutputDefinition = ArgumentDefinition;

/**
 * `root` is opaque on the wire (`JsonObject`). For Flowchart activities the
 * shape is `{ id, type, activities[], connections[] }` plus per-activity
 * metadata that carries the designer position. The graph component narrows
 * this on read; nothing here assumes a specific activity type.
 */
export type WorkflowDefinition = WorkflowDefinitionSummary & {
  root: ActivityJson;
  variables?: VariableDefinition[];
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  outcomes?: string[];
  customProperties?: Record<string, unknown>;
  providerName?: string | null;
  materializerContext?: string | null;
  isReadonly?: boolean;
  options?: WorkflowOptions;
  toolVersion?: string | null;
  labelIds?: string[];
  links?: Link[];
};

/**
 * Wire-shape used by save/import. Matches Elsa's `WorkflowDefinitionModel`.
 * The difference vs `WorkflowDefinition` is mostly that it's missing the
 * server-derived fields (`isLatest`, `isPublished`, `version`, `createdAt`,
 * `materializerName`, `isMaterializerAvailable`).
 */
export type WorkflowDefinitionModel = {
  id?: string;
  definitionId: string;
  tenantId?: string | null;
  name?: string | null;
  description?: string | null;
  toolVersion?: string | null;
  variables?: VariableDefinition[];
  inputs?: InputDefinition[];
  outputs?: OutputDefinition[];
  outcomes?: string[];
  customProperties?: Record<string, unknown>;
  isReadonly?: boolean;
  options?: WorkflowOptions;
  root?: ActivityJson;
  labelIds?: string[];
  links?: Link[];
};

export type SaveWorkflowDefinitionRequest = {
  model: WorkflowDefinitionModel;
  publish?: boolean;
};

export type SaveWorkflowDefinitionResponse = {
  workflowDefinition: WorkflowDefinition;
  alreadyPublished: boolean;
  consumingWorkflowCount: number;
};

export type GetIsNameUniqueResponse = { isUnique: boolean };

export type BulkDeleteWorkflowDefinitionsResponse = { deleted: number };
export type BulkPublishWorkflowDefinitionsResponse = {
  published: string[];
  alreadyPublished: string[];
  notFound: string[];
  updatedConsumers: string[];
};
export type BulkRetractWorkflowDefinitionsResponse = {
  retracted: string[];
  alreadyRetracted: string[];
  notFound: string[];
};
export type UpdateConsumingWorkflowReferencesResponse = {
  affectedWorkflows: string[];
};
export type ImportFilesResponse = { count: number };

/** Identifies a single (definitionId, version) pair, used for revert/delete. */
export type WorkflowDefinitionVersion = {
  id: string;
  definitionId: string;
  version: number;
};

export type ExecuteWorkflowDefinitionRequest = {
  correlationId?: string | null;
  triggerActivityId?: string | null;
  versionOptions?: VersionOptions | null;
  input?: unknown;
};

/** Successful execute returns `{ workflowInstanceId, ... }`. */
export type ExecuteWorkflowResult = {
  workflowInstanceId?: string;
  cannotStart?: boolean;
  [key: string]: unknown;
};

export type ActivityJson = {
  id: string;
  /** Colon-separated hierarchical path emitted by Elsa runtimes. */
  nodeId?: string;
  /** Auto-generated activity name (e.g. `Flowchart1`, `HttpEndpoint2`). */
  name?: string;
  type: string;
  version?: number;
  metadata?: {
    displayText?: string;
    description?: string;
    designer?: {
      position?: { x: number; y: number };
      size?: { width: number; height: number };
    };
    [key: string]: unknown;
  };
  customProperties?: Record<string, unknown>;
  // Flowchart-specific:
  activities?: ActivityJson[];
  connections?: FlowchartConnection[];
  variables?: VariableDefinition[];
  start?: { activity?: string } | string | null;
  [key: string]: unknown;
};

/**
 * A single state inside an `Elsa.StateMachine` activity's `states[]` array.
 * Mirrors the JSON shape produced by the .NET mapper at
 * `src/modules/Elsa.Studio.Workflows.Designer/Services/StateMachineMapper.cs`.
 *
 * The Blazor designer doesn't persist per-state positions today; we stash them
 * under `metadata.designer.position` on each state. The .NET round-trip
 * preserves unknown keys verbatim, so this is forward-compatible.
 */
export type StateMachineState = {
  name: string;
  description?: string;
  /** Activity slot executed when entering the state. */
  entry?: ActivityJson | null;
  /** Activity slot executed when exiting the state. */
  exit?: ActivityJson | null;
  metadata?: {
    designer?: { position?: { x: number; y: number } };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type StateMachineTransition = {
  name?: string | null;
  displayName?: string | null;
  /** Source state name. */
  from: string;
  /** Target state name. */
  to: string;
  /** Trigger activity (e.g. `Elsa.Event`). */
  trigger?: ActivityJson | null;
  /**
   * Condition to evaluate. Can be a boolean literal OR a wrapped activity-like
   * expression node, depending on how the workflow was authored.
   */
  condition?: boolean | ActivityJson | null;
  /** Activity executed when the transition fires. */
  action?: ActivityJson | null;
  [key: string]: unknown;
};

export type FlowchartEndpoint = {
  activity: string;
  port?: string;
};

export type FlowchartConnection = {
  source: FlowchartEndpoint;
  target: FlowchartEndpoint;
  vertices?: { x: number; y: number }[];
};

// --- activity descriptors --------------------------------------------------

export type ActivityKind = "Action" | "Trigger" | "Job" | "Task";
export type PortType = "Embedded" | "Flow";

export type PropertyDescriptor = {
  name: string;
  typeName: string;
  displayName?: string | null;
  description?: string | null;
  order?: number;
  isBrowsable?: boolean | null;
  isSynthetic?: boolean;
};

export type InputDescriptor = PropertyDescriptor & {
  isWrapped?: boolean;
  uiHint: string;
  category?: string | null;
  defaultValue?: unknown;
  defaultSyntax?: string | null;
  isReadOnly?: boolean | null;
  storageDriverType?: string | null;
  uiSpecifications?: Record<string, unknown> | null;
};

export type OutputDescriptor = PropertyDescriptor;

export type Port = {
  name: string;
  displayName?: string | null;
  type: PortType;
  isBrowsable?: boolean | null;
};

export type ActivityDescriptor = {
  typeName: string;
  namespace: string;
  name: string;
  version: number;
  category: string;
  displayName?: string | null;
  description?: string | null;
  inputs: InputDescriptor[];
  outputs: OutputDescriptor[];
  kind: ActivityKind;
  ports: Port[];
  customProperties: Record<string, unknown>;
  constructionProperties: Record<string, unknown>;
  isContainer?: boolean;
  isBrowsable?: boolean;
  isStart?: boolean;
  isTerminal?: boolean;
};

export type ListActivityDescriptorsResponse = {
  items: ActivityDescriptor[];
  count: number;
};

// --- storage drivers / variable types --------------------------------------

export type StorageDriverDescriptor = {
  typeName: string;
  displayName: string;
  priority?: number;
  deprecated?: boolean;
};

export type VariableTypeDescriptor = {
  typeName: string;
  displayName: string;
  category: string;
  description?: string | null;
};

// --- workflow instances ----------------------------------------------------

export type WorkflowStatus = "Running" | "Finished" | "Cancelled" | "Faulted";
export type WorkflowSubStatus =
  | "Executing"
  | "Suspended"
  | "Finished"
  | "Cancelled"
  | "Faulted"
  | "Pending";

export type WorkflowInstanceSummary = {
  id: string;
  definitionId: string;
  definitionVersionId?: string;
  /**
   * Workflow definition version number. Server emits this as `version` on the
   * summary endpoint (camelCase of `Version`) — NOT `definitionVersion`.
   */
  version?: number;
  name?: string | null;
  status: WorkflowStatus;
  subStatus: WorkflowSubStatus;
  correlationId?: string | null;
  /**
   * Count of incidents recorded on this instance. The server returns it on the
   * summary endpoint — used by the list column and the red-tinted badge when
   * non-zero.
   */
  incidentCount?: number;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string | null;
};

/** Mirrors Elsa's runtime `ActivityStatus` enum (string-encoded on the wire). */
export type ActivityStatus =
  | "Pending"
  | "Running"
  | "Completed"
  | "Faulted"
  | "Cancelled"
  | "Canceled"; // server has historically spelled this both ways

/** One execution of a single activity inside a workflow instance — summary form. */
export type ActivityExecutionRecordSummary = {
  id: string;
  workflowInstanceId: string;
  activityId: string;
  activityNodeId: string;
  activityType: string;
  activityTypeVersion: number;
  activityName?: string | null;
  startedAt: string;
  completedAt?: string | null;
  status: ActivityStatus;
  hasBookmarks?: boolean;
  metadata?: Record<string, unknown> | null;
};

/**
 * Reference to a memory slot (variable, output, …). Identifies the slot by
 * id; the runtime resolves the slot's storage based on its type.
 */
export type MemoryReference = {
  id: string;
};

/**
 * The persisted shape of an activity output binding. Lives at
 * `activity.<camelize(descriptorName)>` for every browsable output the
 * descriptor declares.
 */
export type ActivityOutputBinding = {
  typeName: string;
  memoryReference: MemoryReference;
};

/** Descriptor for an expression syntax (Literal / JavaScript / CSharp / …). */
export type ExpressionDescriptor = {
  type: string;
  displayName: string;
  isSerializable?: boolean;
  isBrowsable?: boolean;
  /** Free-form bag — `MonacoLanguage` decides if/how this syntax uses Monaco. */
  properties?: Record<string, unknown> | null;
};

/** A workflow-definition label (folder/tag). */
export type Label = {
  id: string;
  name: string;
  normalizedName?: string;
  description?: string | null;
  color?: string | null;
};

/** Descriptor for a commit strategy (activity-level). */
export type CommitStrategyDescriptor = {
  name: string;
  displayName: string;
  description?: string | null;
};

/**
 * Descriptor for a resilience strategy. Returned by `GET /resilience/strategies`.
 *
 * The server serializes the *entire* strategy object with a `$type`
 * discriminator (e.g. `"HttpResilienceStrategy"`) plus every public field —
 * see `Elsa.Resilience.Core.Serialization.ResilienceStrategySerializer`. We
 * keep the extra fields as an open bag so the UI can surface what each
 * strategy actually does (retry count, delay, backoff…) without the type
 * needing to know every concrete strategy.
 */
export type ResilienceStrategyDescriptor = {
  id: string;
  displayName: string;
  description?: string | null;
  /** .NET type name of the strategy (e.g. "HttpResilienceStrategy"). */
  $type?: string;
  /** Common knob — present on `HttpResilienceStrategy` and likely others. */
  maxRetryAttempts?: number;
  /** ISO-8601 duration string (e.g. `"00:00:01"`). */
  delay?: string;
  useJitter?: boolean;
  /** `"Linear" | "Exponential" | "Constant"` per Polly's `DelayBackoffType`. */
  backoffType?: string;
  /** Catch-all for fields specific to less common strategies. */
  [key: string]: unknown;
};

/** Persisted shape of an activity's resilience configuration. */
export type ResilienceStrategyConfig = {
  /** "Identifier" picks a registered strategy by id; "Expression" supplies one dynamically. */
  mode: "Identifier" | "Expression";
  strategyId?: string | null;
  expression?: { type?: string; value?: string } | null;
};

/** Full record for an activity execution — inputs/outputs/exception/state. */
export type ActivityExecutionRecord = ActivityExecutionRecordSummary & {
  activityState?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  outputs?: Record<string, unknown> | null;
  properties?: Record<string, unknown> | null;
  exception?: {
    type?: string;
    message?: string;
    stackTrace?: string;
    innerException?: unknown;
  } | null;
  aggregateFaultCount?: number;
};

/**
 * One entry from the workflow execution log. Wire shape mirrors Elsa's
 * `ExecutionLogRecord` payload returned by `GET/POST /workflow-instances/{id}/journal`.
 *
 * Unlike `ActivityExecutionRecordSummary`, this stream includes workflow-level
 * lifecycle events (e.g. `Workflow Started`, `Workflow Suspended`, `Workflow Faulted`)
 * alongside activity events. Server emits the discriminator on `eventName`.
 */
export type WorkflowExecutionLogRecord = {
  id: string;
  activityInstanceId: string;
  parentActivityInstanceId?: string | null;
  activityId: string;
  activityType: string;
  activityTypeVersion: number;
  activityName?: string | null;
  nodeId: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Monotonic per-instance order — use as a tiebreaker when timestamps collide. */
  sequence: number;
  eventName?: string | null;
  message?: string | null;
  source?: string | null;
  activityState?: Record<string, unknown> | null;
  payload?: unknown;
};

/** Filter shape for `POST /workflow-instances/{id}/journal`. */
export type JournalFilter = {
  activityIds?: string[];
  activityNodeIds?: string[];
  excludedActivityTypes?: string[];
  eventNames?: string[];
};
