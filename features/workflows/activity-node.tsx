"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { MoreVertical, RotateCw, ShieldCheck } from "lucide-react";
import { useMemo, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from "react";

import { extractBindings } from "@/features/workflows/activity-bindings";
import { ActivityBindingsStrip } from "@/features/workflows/activity-bindings-strip";
import { ActivityMutationsButton } from "@/features/workflows/activity-mutations-button";
import { displayFor } from "@/features/workflows/activity-display";
import { ACTIVITY_DRAG_MIME } from "@/features/workflows/activity-palette";
import {
  badgeStateFromStats,
  hasRetryAttempts,
  TONE_CLASSES,
  type ActivityStats,
} from "@/features/workflows/activity-stats";
import {
  findActivityById,
  isFlowchartContainer,
  useEditorStore,
} from "@/features/workflows/editor-store";
import { getEmbeddedChildren, setEmbeddedChildren } from "@/features/workflows/embedded-ports";
import { makeActivity } from "@/features/workflows/make-activity";
import { makeFlowchart } from "@/features/workflows/make-flowchart";
import { updateActivity } from "@/features/workflows/update-activity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type {
  ActivityDescriptor,
  ActivityJson,
  ActivityKind,
  Port as PortDescriptor,
} from "@/lib/api/types";

export type ActivityNodeData = {
  /** User-set name | metadata.displayText | descriptor.displayName | fallback. */
  label: string;
  /** Fully qualified type, e.g. "Elsa.WriteLine". */
  typeName: string;
  /** Last segment of the type name; only used as a last-resort caption. */
  typeShort: string;
  /** Whether this activity is the flowchart entry point (drives the "Start" ribbon). */
  isStart?: boolean;
  /** Mirrors the Blazor `canStartWorkflow` flag — triggers and explicit starts. */
  canStartWorkflow?: boolean;
  /** Description text from metadata.description or the descriptor. */
  description?: string;
  /** Whether to render the description line under the type. */
  showDescription?: boolean;
  /** Marks the synthetic node for non-Flowchart roots. */
  isFlowchart?: boolean;
  /** Execution stats (driven by the instance viewer; absent in the editor). */
  stats?: ActivityStats;
};

/**
 * Top-level React Flow node. Pulls the live activity JSON from the store so
 * embedded children render correctly without round-tripping through
 * `ActivityNodeData`.
 */
export function ActivityNode({ id, data, selected }: NodeProps) {
  const d = data as ActivityNodeData;
  const root = useEditorStore((s) => s.definition?.root);
  const activity = useMemo(() => findActivityById(root ?? null, id), [root, id]);
  const descriptors = useActivityDescriptors();
  const descriptor = useMemo(
    () => descriptors.data?.find((x) => x.typeName === d.typeName) ?? null,
    [descriptors.data, d.typeName],
  );

  const removeActivity = useEditorStore((s) => s.removeActivityById);
  const duplicateActivity = useEditorStore((s) => s.duplicateActivityById);
  const toggleStart = useEditorStore((s) => s.toggleCanStartWorkflow);

  const display = displayFor(d.typeName, descriptor);
  const kind: ActivityKind | undefined = descriptor?.kind;
  const isTrigger = kind === "Trigger";
  const filled = !!d.canStartWorkflow || isTrigger;

  const badge = badgeStateFromStats(d.stats);
  const retrying = hasRetryAttempts(d.stats);
  // Workflow-state references this activity touches — drives the chip strip
  // under the card body. Resolved against the workflow's declared variables,
  // inputs and outputs so renamed targets stay matched and missing ones
  // surface a warning chip. Subscribed individually to keep re-renders local.
  const variables = useEditorStore((s) => s.definition?.variables);
  const wfInputs = useEditorStore((s) => s.definition?.inputs);
  const wfOutputs = useEditorStore((s) => s.definition?.outputs);
  const bindings = useMemo(
    () =>
      extractBindings(activity, descriptor, {
        variables: variables ?? [],
        inputs: wfInputs ?? [],
        outputs: wfOutputs ?? [],
      }),
    [activity, descriptor, variables, wfInputs, wfOutputs],
  );

  // Surface activities with a configured resilience strategy via a small
  // shield icon — so the user can scan the canvas and see at a glance which
  // activities have a retry policy. Skipped when the slot is just the
  // explicit "Inherit from workflow default" placeholder (`strategyId: null`).
  const resilience = activity
    ? (activity.customProperties as Record<string, unknown> | undefined)?.resilienceStrategy as
        | { mode?: string; strategyId?: string | null }
        | undefined
    : undefined;
  const hasResilience =
    !!resilience &&
    ((resilience.mode === "Identifier" && !!resilience.strategyId) ||
      resilience.mode === "Expression");
  const resilienceLabel =
    resilience?.mode === "Expression"
      ? "Resilience: dynamic (expression)"
      : resilience?.strategyId
        ? `Resilience: ${resilience.strategyId}`
        : "Resilience strategy configured";

  // Authorization indicator — driven by an `authorize`-style boolean input.
  // HttpEndpoint declares one (`Input<bool> Authorize`) and an optional
  // `Policy` companion; we read both so the tooltip can name the policy.
  // Other activities that adopt the same convention pick this up for free.
  // Conservative truthiness: a literal `true` OR any non-literal expression
  // (we can't evaluate at design time but want to flag that auth is wired).
  const auth = readAuthorizeIndicator(activity);

  // "Mutates workflow state" indicator — fires when the activity has any
  // resolved write target on the workflow (declared variable or workflow
  // output). The bindings popover still has the full breakdown; this is a
  // quick at-a-glance pencil icon (rendered by `ActivityMutationsButton`)
  // that opens a focused dialog explaining each mutation.
  const hasMutations = bindings.writes.some((w) => !w.missing);
  // "Currently running": started but not yet completed, and not faulted/blocked.
  const isRunning = !!d.stats &&
    d.stats.started > d.stats.completed &&
    !d.stats.faulted &&
    !d.stats.blocked;
  // Surface faulted activities directly on the card itself (not just via the
  // small corner badge) so they're immediately obvious in a busy graph.
  const isFaulted = !!d.stats?.faulted;

  // Right-side flow ports. Resolution order, matching the Blazor designer:
  //   1. FlowSwitch — one port per case label + a "Default" fallback. The
  //      case list is dynamic so descriptors can't enumerate them; we read
  //      `activity.cases[]` directly.
  //   2. Activity-level `outcomes` (FlowSwitch / dynamic-outcome activities).
  //   3. Descriptor-declared browsable Flow ports.
  //   4. Synthetic single "Done" port — every action-style activity has one.
  // Triggers don't have a default outbound port (they're entry points, not
  // exits) so we suppress the fallback for them.
  const sourcePorts = useMemo<PortDescriptor[]>(() => {
    // 1. FlowSwitch — flow ports are per-case + default.
    if (activity && shortType(activity.type) === "FlowSwitch") {
      const cases = readCaseLabels(activity);
      return [
        ...cases.map((label) => ({ name: label, displayName: label, type: "Flow" as const })),
        { name: "Default", displayName: "Default", type: "Flow" as const },
      ];
    }

    // 2. Descriptor-declared Flow ports.
    const flowPorts = (descriptor?.ports ?? []).filter(
      (p) => p.type === "Flow" && p.isBrowsable !== false,
    );
    if (flowPorts.length > 0) return flowPorts;

    // 3. Activity outcomes (dynamic-outcomes hint, custom FlowJoin labels…).
    const outcomes = activity && Array.isArray((activity as Record<string, unknown>).outcomes)
      ? ((activity as Record<string, unknown>).outcomes as string[]).filter(
          (o): o is string => typeof o === "string" && o.length > 0,
        )
      : [];
    if (outcomes.length > 0) {
      return outcomes.map((name) => ({ name, displayName: name, type: "Flow" }));
    }

    // 4. Default "Done" port.
    return [{ name: "Done", displayName: "Done", type: "Flow" }];
  }, [descriptor?.ports, activity]);

  return (
    <div
      className={[
        "group relative min-w-[220px] max-w-[320px] rounded-xl border shadow-sm transition-all",
        // Selection ring wins visually but combines with the faulted ring so
        // the user still sees "this is the failing one" while it's selected.
        selected
          ? isFaulted
            ? "ring-2 ring-rose-500 ring-offset-2 ring-offset-background shadow-md"
            : "ring-2 ring-sky-500/70 ring-offset-2 ring-offset-background shadow-md"
          : isFaulted
            ? "ring-2 ring-rose-500/60 shadow-md"
            : "hover:-translate-y-px hover:shadow-md",
        d.isStart ? "border-primary/60" : "border-border",
        isFaulted ? "border-rose-500/70" : "",
        filled ? "" : "bg-card",
        // Pulsing sky-blue ring while the activity is currently executing.
        // Skipped when faulted — we don't want a happy pulse around a failure.
        isRunning && !isFaulted ? "ring-2 ring-sky-500/60 animate-pulse" : "",
      ].join(" ")}
      style={filled ? { background: display.color, color: "#ffffff" } : undefined}
    >
      {/* Start ribbon */}
      {d.isStart ? (
        <span
          className="absolute -top-2 left-3 rounded-full px-1.5 py-px text-2xs font-semibold uppercase tracking-wide text-white shadow-sm"
          style={{ background: filled ? "rgba(0,0,0,0.35)" : display.color }}
        >
          Start
        </span>
      ) : null}

      {/* Stats badge (instance viewer) */}
      {badge ? (
        <span
          className={[
            "absolute -top-2 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border px-1 text-2xs font-semibold leading-none shadow-sm",
            TONE_CLASSES[badge.tone],
          ].join(" ")}
          title={badgeTitleFromStats(d.stats)}
        >
          {badge.icon ? (
            <badge.icon className="size-3" strokeWidth={2.5} />
          ) : (
            <span>{badge.content}</span>
          )}
        </span>
      ) : null}

      {/* Corner-indicator row — keeps the retry dot, resilience badge,
          mutation badge and auth badge laid out side-by-side with a
          consistent gap, regardless of which combination is showing.
          Render each as a flex child so we stop computing brittle
          left-offset math by hand. */}
      {(retrying || hasResilience || hasMutations || auth) ? (
        <div className="absolute top-1 left-1 flex items-center gap-1">
          {retrying ? (
            <span
              aria-hidden
              className="size-2 rounded-full bg-amber-400 ring-2 ring-background"
              title="Retried at least once"
            />
          ) : null}
          {hasResilience ? (
            <span
              className="flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-emerald-500/60 shadow-sm"
              title={resilienceLabel}
            >
              <RotateCw className="size-2.5 text-emerald-600" strokeWidth={2.5} />
            </span>
          ) : null}
          {hasMutations ? (
            <ActivityMutationsButton
              activityName={d.label}
              writes={bindings.writes.filter((w) => !w.missing)}
              variables={variables ?? []}
            />
          ) : null}
          {auth ? (
            <span
              className="flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-sky-500/60 shadow-sm"
              title={auth.label}
            >
              <ShieldCheck className="size-2.5 text-sky-600" strokeWidth={2.5} />
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Activity card body — header + optional embedded port slots. */}
      <ActivityCardBody
        activity={activity}
        descriptor={descriptor}
        fallbackLabel={d.label}
        fallbackTypeShort={d.typeShort}
        fallbackDescription={d.description}
        fallbackShowDescription={d.showDescription}
        filled={filled}
        topLevel
      />

      {/* Variable / input / output usage strip — only renders when the
          activity actually reads or writes workflow state. */}
      <ActivityBindingsStrip bindings={bindings} filled={filled} />

      {/* Action menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={[
            "absolute top-1 right-1 inline-flex size-6 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-black/10 group-hover:opacity-100 focus:opacity-100",
            filled ? "text-white" : "text-muted-foreground",
          ].join(" ")}
          aria-label="Activity actions"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onSelect={() => toggleStart(id)}>
            {isTrigger ? "Toggle trigger" : "Toggle starting point"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => duplicateActivity(id)}>
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => removeActivity(id)}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Inbound (left) handle — single port. Triggers don't accept inbound. */}
      {!isTrigger ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-3 !border-2 !border-sky-500/80 !bg-background !z-10"
        />
      ) : null}

      {/* Outbound (right) handles — always labelled. Each handle is absolutely
            positioned at top:N/(M+1)% so a single port lands at exactly 50%
            (the card's vertical centre) and edges between same-row nodes draw
            as straight horizontal lines. Labels are rendered as separate
            absolute siblings at the same Y so they don't perturb handle
            measurement. */}
      {sourcePorts.map((p, i) => {
        const topPct = ((i + 1) / (sourcePorts.length + 1)) * 100;
        return (
          <span
            key={`${p.name}-label`}
            className={[
              "absolute rounded-sm border px-1 py-px text-2xs font-medium leading-none pointer-events-none",
              filled ? "" : "bg-card/90 text-muted-foreground",
            ].join(" ")}
            style={{
              right: 10,
              top: `${topPct}%`,
              transform: "translateY(-50%)",
              ...(filled
                ? {
                    background: "rgba(255,255,255,0.18)",
                    color: "#ffffff",
                    borderColor: "rgba(255,255,255,0.35)",
                  }
                : {}),
            }}
          >
            {p.displayName ?? p.name}
          </span>
        );
      })}
      {sourcePorts.map((p, i) => {
        const topPct = ((i + 1) / (sourcePorts.length + 1)) * 100;
        return (
          <Handle
            key={p.name}
            type="source"
            position={Position.Right}
            id={p.name}
            className="!size-3 !border-2 !border-background !z-10"
            style={{
              top: `${topPct}%`,
              background: filled ? "#ffffff" : display.color,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * The header + (optional) embedded-port slots of an activity. Reused recursively
 * for embedded children, where it's rendered without ReactFlow handles.
 */
function ActivityCardBody({
  activity,
  descriptor,
  fallbackLabel,
  fallbackTypeShort,
  fallbackDescription,
  fallbackShowDescription,
  filled,
  topLevel,
}: {
  activity: ActivityJson | null;
  descriptor: ActivityDescriptor | null;
  fallbackLabel?: string;
  fallbackTypeShort?: string;
  fallbackDescription?: string;
  fallbackShowDescription?: boolean;
  filled: boolean;
  topLevel: boolean;
}) {
  const display = displayFor(activity?.type ?? descriptor?.typeName, descriptor);
  const Icon = display.icon;

  const label = activityLabel(activity) ?? fallbackLabel ?? descriptor?.displayName ?? "Activity";
  const typeCaption =
    descriptor?.displayName?.trim() ||
    fallbackTypeShort ||
    (activity ? shortType(activity.type) : "Activity");

  const md = (activity?.metadata as Record<string, unknown> | undefined) ?? {};
  const showDescription =
    (md.showDescription === true) || fallbackShowDescription === true;
  const description = showDescription
    ? (typeof md.description === "string" && md.description.trim()) ||
      fallbackDescription?.trim() ||
      descriptor?.description?.trim() ||
      ""
    : "";

  const embeddedPorts = useMemo<PortDescriptor[]>(() => {
    // Switch (non-flow) — one embedded slot per case + a Default slot.
    if (activity && shortType(activity.type) === "Switch") {
      const cases = readCaseLabels(activity);
      return [
        ...cases.map((label) => ({ name: label, displayName: label, type: "Embedded" as const })),
        { name: "Default", displayName: "Default", type: "Embedded" as const },
      ];
    }
    return (descriptor?.ports ?? []).filter(
      (p) => p.type === "Embedded" && p.isBrowsable !== false,
    );
  }, [descriptor?.ports, activity]);

  return (
    <div className="flex flex-col">
      <div className={["flex items-stretch gap-2.5 p-2.5", topLevel ? "pr-14" : ""].join(" ")}>
        <div
          className="flex size-[42px] shrink-0 items-center justify-center rounded-md"
          style={
            filled
              ? { background: "rgba(255,255,255,0.18)", color: "#ffffff" }
              : { background: display.color, color: "#ffffff" }
          }
        >
          <Icon className="size-5" strokeWidth={2} />
        </div>
        <div className="flex min-w-0 flex-col justify-center gap-0.5">
          <p
            className="truncate text-sm font-medium leading-tight"
            title={label}
            style={filled ? { color: "#ffffff" } : undefined}
          >
            {label}
          </p>
          <p
            className={[
              "truncate text-xs leading-tight",
              filled ? "" : "text-muted-foreground",
            ].join(" ")}
            title={typeCaption}
            style={filled ? { color: "rgba(255,255,255,0.85)" } : undefined}
          >
            {typeCaption}
          </p>
          {description ? (
            <p
              className={[
                "mt-0.5 truncate text-xs leading-tight",
                filled ? "" : "text-muted-foreground",
              ].join(" ")}
              title={description}
              style={filled ? { color: "rgba(255,255,255,0.75)" } : undefined}
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {activity && embeddedPorts.length > 0 ? (
        <div className="grid gap-1.5 px-2 pb-2">
          {embeddedPorts.map((port) => (
            <EmbeddedPortSlot key={port.name} parent={activity} port={port} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function EmbeddedPortSlot({
  parent,
  port,
}: {
  parent: ActivityJson;
  port: PortDescriptor;
}) {
  const children = getEmbeddedChildren(parent, port);
  const setRoot = useEditorStore((s) => s.setRoot);
  const pushSnapshot = useEditorStore((s) => s.pushSnapshot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);
  const enterContainerByPort = useEditorStore((s) => s.enterContainerByPort);
  const setSelectedActivityId = useEditorStore((s) => s.setSelectedActivityId);
  const descriptors = useActivityDescriptors();
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = (e: ReactDragEvent) => {
    if (readOnly) return;
    if (!e.dataTransfer.types.includes(ACTIVITY_DRAG_MIME)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) setIsDragOver(true);
  };

  const onDragLeave = (e: ReactDragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const onDrop = (e: ReactDragEvent) => {
    if (readOnly) return;
    e.preventDefault();
    // Stop the canvas-level drop handler from also creating a top-level node.
    e.stopPropagation();
    setIsDragOver(false);
    const typeName = e.dataTransfer.getData(ACTIVITY_DRAG_MIME);
    if (!typeName || !root) return;
    const descriptor = descriptors.data?.find((d) => d.typeName === typeName);
    const child = makeActivity(typeName, descriptor, null, parent.nodeId ?? "", root);
    pushSnapshot();
    setRoot(
      updateActivity(root, parent.id, (a) =>
        setEmbeddedChildren(a, port, [...getEmbeddedChildren(a, port), child]),
      ),
    );
  };

  // Click handler mirrors Blazor's `OnActivityEmbeddedPortSelected`:
  // an empty port creates a fresh Flowchart child and drills into it;
  // a port whose child is already a Flowchart drills in; anything else
  // just selects the existing child in the right inspector.
  const portLabel = port.displayName ?? port.name;
  const onClick = (e: ReactMouseEvent) => {
    if (readOnly || !root) return;
    e.stopPropagation();
    const existing = children[0];
    if (existing && isFlowchartContainer(existing)) {
      enterContainerByPort(parent.id, port.name, portLabel);
      return;
    }
    if (!existing) {
      const flowchart = makeFlowchart(
        descriptors.data ?? [],
        parent.nodeId ?? "",
        root,
      );
      pushSnapshot();
      setRoot(
        updateActivity(root, parent.id, (a) => setEmbeddedChildren(a, port, [flowchart])),
      );
      enterContainerByPort(parent.id, port.name, portLabel);
      return;
    }
    setSelectedActivityId(existing.id);
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      className={[
        "rounded-md border border-dashed p-1.5 transition-colors",
        isDragOver
          ? "border-sky-500 bg-sky-500/10"
          : "border-muted-foreground/40 bg-background/60",
        readOnly ? "" : "hover:border-foreground/30 hover:bg-muted/40 cursor-pointer",
      ].join(" ")}
      title={
        readOnly
          ? undefined
          : children.length === 0
            ? `Click to create a Flowchart in ${portLabel}`
            : `Click to open ${portLabel}`
      }
    >
      <div className="text-muted-foreground mb-1 px-0.5 text-2xs font-medium uppercase tracking-wide">
        {portLabel}
      </div>
      {children.length === 0 ? (
        <div className="text-muted-foreground/70 px-1 py-1 text-2xs italic">
          {readOnly ? "Empty" : "Click to add a Flowchart · or drop an activity"}
        </div>
      ) : (
        <div className="grid gap-1">
          {children.map((child) => (
            <EmbeddedActivityCard key={child.id} activity={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A compact activity card for embedded children. Click selects the activity
 * in the right pane; the click intentionally bubbles to the enclosing
 * `EmbeddedPortSlot` so its open/drill handler can take over when the
 * child is itself a Flowchart.
 */
function EmbeddedActivityCard({ activity }: { activity: ActivityJson }) {
  const descriptors = useActivityDescriptors();
  const descriptor = useMemo(
    () => descriptors.data?.find((x) => x.typeName === activity.type) ?? null,
    [descriptors.data, activity.type],
  );
  const selectedId = useEditorStore((s) => s.selectedActivityId);
  const setSelected = useEditorStore((s) => s.setSelectedActivityId);
  const isSelected = selectedId === activity.id;

  const filled = (activity as Record<string, unknown>).canStartWorkflow === true;

  const onClick = () => {
    // Do NOT call stopPropagation — the parent EmbeddedPortSlot needs the
    // event so it can drill into Flowchart children. The slot also calls
    // stopPropagation itself, which keeps the ReactFlow node click silent.
    setSelected(activity.id);
  };

  return (
    <div
      onClick={onClick}
      className={[
        "cursor-pointer rounded-md border bg-card text-card-foreground shadow-sm transition-colors",
        isSelected
          ? "ring-1 ring-sky-500/70"
          : "border-border hover:bg-muted/40",
      ].join(" ")}
    >
      <ActivityCardBody
        activity={activity}
        descriptor={descriptor}
        filled={filled}
        topLevel={false}
      />
    </div>
  );
}

function activityLabel(activity: ActivityJson | null | undefined): string | undefined {
  if (!activity) return undefined;
  const md = (activity.metadata as Record<string, unknown> | undefined) ?? {};
  const dt = md.displayText;
  if (typeof dt === "string" && dt.trim()) return dt;
  if (typeof activity.id === "string" && activity.id) return activity.id;
  return undefined;
}

function shortType(typeName: string): string {
  const segs = typeName.split(".");
  return segs[segs.length - 1] ?? typeName;
}

/**
 * Read the `label` of each entry in `activity.cases`. Used by Switch /
 * FlowSwitch to render one port per case. Falls back to "Case 1", "Case 2", …
 * when an entry has no label.
 */
function readCaseLabels(activity: ActivityJson): string[] {
  const raw = (activity as Record<string, unknown>).cases;
  if (!Array.isArray(raw)) return [];
  return raw.map((c, i) => {
    if (c && typeof c === "object") {
      const label = (c as Record<string, unknown>).label;
      if (typeof label === "string" && label.trim().length > 0) return label;
    }
    return `Case ${i + 1}`;
  });
}

function badgeTitleFromStats(stats: ActivityStats | undefined): string | undefined {
  if (!stats) return undefined;
  const parts: string[] = [];
  if (stats.started) parts.push(`Started: ${stats.started}`);
  if (stats.completed) parts.push(`Completed: ${stats.completed}`);
  if (stats.uncompleted) parts.push(`Uncompleted: ${stats.uncompleted}`);
  if (stats.faulted) parts.push("Faulted");
  if (stats.blocked) parts.push("Blocked");
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Inspect an activity for an `Authorize`-style wrapped boolean input and the
 * companion `Policy` string input. Returns a label for the canvas badge when
 * authorization is enabled, or `null` when it isn't.
 *
 * Truthiness rules:
 *  - Literal `true` on `expression.value` ⇒ enabled.
 *  - Non-literal expression (JavaScript, Liquid, …) ⇒ assume enabled. We
 *    can't evaluate at design time, but a hand-rolled expression is meaningful
 *    intent — surfacing the lock helps the user notice it.
 *  - Anything else (false, missing, empty) ⇒ no badge.
 */
function readAuthorizeIndicator(
  activity: ActivityJson | null,
): { label: string } | null {
  if (!activity) return null;
  const auth = (activity as Record<string, unknown>).authorize;
  if (auth === undefined || auth === null) return null;

  let enabled: boolean;
  if (typeof auth === "boolean") {
    // Naked boolean — shouldn't happen for HttpEndpoint but supported for
    // forward compatibility with activities that declare a bare `bool` field.
    enabled = auth;
  } else if (typeof auth === "object") {
    const expr = (auth as { expression?: { type?: string; value?: unknown } })
      .expression;
    if (!expr) return null;
    if (expr.type === "Literal") {
      enabled = expr.value === true;
    } else {
      // Non-literal expressions ARE auth-aware intent; surface the badge with
      // a "dynamic" tooltip so the user knows it's resolved at runtime.
      enabled = true;
    }
  } else {
    return null;
  }
  if (!enabled) return null;

  // Optional policy name from the companion `Policy` input (also wrapped).
  let policy: string | undefined;
  const pol = (activity as Record<string, unknown>).policy;
  if (pol && typeof pol === "object") {
    const expr = (pol as { expression?: { type?: string; value?: unknown } })
      .expression;
    if (expr?.type === "Literal" && typeof expr.value === "string" && expr.value.trim()) {
      policy = expr.value.trim();
    }
  } else if (typeof pol === "string" && pol.trim()) {
    policy = pol.trim();
  }

  // Distinguish the "literal true" case from a dynamic expression in the
  // tooltip so the user knows when auth is conditional at runtime.
  const isDynamic =
    typeof auth === "object" &&
    (auth as { expression?: { type?: string } }).expression?.type !== "Literal";
  if (isDynamic) {
    return { label: "Authorization required (dynamic)" };
  }
  return {
    label: policy ? `Authorization required · policy: ${policy}` : "Authorization required",
  };
}
