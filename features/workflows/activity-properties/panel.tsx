"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  Copy,
  FlaskConical,
  GitMerge,
  HardDriveDownload,
  MoreVertical,
  MousePointerSquareDashed,
  Plus,
  ScrollText,
  ShieldCheck,
  Sliders,
  Trash2,
  Workflow,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displayFor } from "@/features/workflows/activity-display";
import { isStateMachineRoot } from "@/features/workflows/build-graph";
import { ConnectMenu } from "@/features/workflows/connect-menu";
import {
  findActivityById,
  useEditorStore,
} from "@/features/workflows/editor-store";
import { setEmbeddedChildren } from "@/features/workflows/embedded-ports";
import { makeActivity } from "@/features/workflows/make-activity";
import { ActivityCommitStrategyTab } from "@/features/workflows/activity-properties/commit-strategy-tab";
import { ActivityCommonTab } from "@/features/workflows/activity-properties/common-tab";
import { ActivityInputsTab } from "@/features/workflows/activity-properties/inputs-tab";
import { ActivityLogPersistenceTab } from "@/features/workflows/activity-properties/log-persistence-tab";
import { ActivityOutputsTab } from "@/features/workflows/activity-properties/outputs-tab";
import { ActivityResilienceTab } from "@/features/workflows/activity-properties/resilience-tab";
import { ActivityTaskTab } from "@/features/workflows/activity-properties/task-tab";
import { ActivityTestsTab } from "@/features/workflows/activity-properties/tests-tab";
import { SectionCard } from "@/features/workflows/activity-properties/section-card";
import {
  WorkflowVersionCard,
  isWorkflowDefinitionActivity,
} from "@/features/workflows/activity-properties/workflow-version-card";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type {
  ActivityDescriptor,
  ActivityJson,
  StateMachineState,
  StateMachineTransition,
} from "@/lib/api/types";

type Tab = "config" | "tests";

/**
 * Right-side inspector for the currently selected activity.
 *
 *   ┌────────────────────────────────────┐
 *   │ Identity band (tinted)             │   icon · name · id · kebab
 *   │ Underline tabs                     │   Inputs · Outputs · Setup
 *   ├────────────────────────────────────┤
 *   │ Tab content                        │
 *   ├────────────────────────────────────┤
 *   │ About strip                        │
 *   └────────────────────────────────────┘
 */
export function ActivityPropertiesPanel() {
  const selectedId = useEditorStore((s) => s.selectedActivityId);
  const selectedTransitionIndex = useEditorStore(
    (s) => s.selectedTransitionIndex,
  );
  const root = useEditorStore((s) => s.definition?.root);
  const activity = useMemo(
    () => (selectedId ? findActivityById(root, selectedId) : null),
    [selectedId, root],
  );
  const descriptors = useActivityDescriptors();
  const descriptor = useMemo(
    () => descriptors.data?.find((d) => d.typeName === activity?.type) ?? null,
    [descriptors.data, activity?.type],
  );

  const setRoot = useEditorStore((s) => s.setRoot);
  const removeActivity = useEditorStore((s) => s.removeActivityById);
  const duplicateActivity = useEditorStore((s) => s.duplicateActivityById);
  const toggleStart = useEditorStore((s) => s.toggleCanStartWorkflow);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);

  const [tab, setTab] = useState<Tab>("config");

  // When the canvas root is a State Machine and the user clicked a state node,
  // `selectedActivityId` holds the state name (not an activity id), so
  // `findActivityById` returns null. Show a state details card instead of the
  // generic empty state.
  const selectedState = useMemo(() => {
    if (activity) return null;
    if (!selectedId || !root) return null;
    if (!isStateMachineRoot(root)) return null;
    const states = (root.states as StateMachineState[] | undefined) ?? [];
    return states.find((s) => s.name === selectedId) ?? null;
  }, [activity, selectedId, root]);

  const selectedTransition = useMemo(() => {
    if (selectedTransitionIndex == null || !root) return null;
    if (!isStateMachineRoot(root)) return null;
    const transitions =
      (root.transitions as StateMachineTransition[] | undefined) ?? [];
    return transitions[selectedTransitionIndex] ?? null;
  }, [selectedTransitionIndex, root]);

  if (selectedTransition && root && selectedTransitionIndex != null) {
    return (
      <TransitionDetailsPanel
        transition={selectedTransition}
        transitionIndex={selectedTransitionIndex}
        root={root}
        readOnly={readOnly}
      />
    );
  }
  if (!activity && selectedState && root) {
    return (
      <StateDetailsPanel
        state={selectedState}
        root={root}
        readOnly={readOnly}
      />
    );
  }
  if (!activity) return <EmptyState />;

  const display = displayFor(activity.type, descriptor);
  const Icon = display.icon;
  const displayName =
    (activity.metadata?.displayText as string | undefined) ??
    descriptor?.displayName ??
    activity.type.split(".").at(-1) ??
    activity.type;
  const kind = descriptor?.kind;
  const isTrigger = kind === "Trigger";
  const isStart =
    (activity as Record<string, unknown>).canStartWorkflow === true || isTrigger;
  const onRenameDisplayText = (next: string) => {
    if (!root) return;
    const trimmed = next.trim() || displayName;
    setRoot(setMetadataDisplayText(root, activity.id, trimmed));
  };

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as Tab)}
      className="flex h-full min-h-0 flex-1 flex-col gap-0"
    >
      {/* ───── Identity band ──────────────────────────────────────── */}
      <header
        className="border-b"
        style={{ background: "var(--panel-surface)" }}
      >
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div
            className="relative flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-black/5 dark:ring-white/5"
            style={{
              background: `color-mix(in oklch, ${display.color} 16%, transparent)`,
              color: display.color,
            }}
          >
            <Icon className="size-5" />
            {isStart ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span
                      aria-label={isTrigger ? "Trigger" : "Starting point"}
                      className="bg-card absolute -right-1 -top-1 inline-flex size-3.5 items-center justify-center rounded-full border"
                    />
                  }
                >
                  <span
                    className="bg-primary inline-block size-2 rounded-full"
                    aria-hidden
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {isTrigger ? "Trigger" : "Workflow starting point"}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <InlineNameEditor
              value={displayName}
              onChange={onRenameDisplayText}
              readOnly={readOnly}
            />
            <ActivityIdLine id={activity.id} />
          </div>
          <ActivityActions
            isTrigger={isTrigger}
            disabled={readOnly}
            onToggleStart={() => toggleStart(activity.id)}
            onDuplicate={() => duplicateActivity(activity.id)}
            onRemove={() => removeActivity(activity.id)}
          />
        </div>

        {/* ───── Tab strip (underline variant) ───────────────────── */}
        <TabsList
          variant="line"
          className="h-9 w-full justify-start gap-4 rounded-none border-t bg-transparent px-4"
        >
          <TabsTrigger value="config" className="px-1">
            <Sliders className="size-3.5" />
            <span>Configuration</span>
          </TabsTrigger>
          <TabsTrigger value="tests" className="px-1">
            <FlaskConical className="size-3.5" />
            <span>Tests</span>
          </TabsTrigger>
        </TabsList>
      </header>

      {/* ───── Scrollable tab content ─────────────────────────────── */}
      <div className="bg-background min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="config" className="p-4">
          <ConfigurationSections
            activity={activity}
            descriptor={descriptor}
            kind={kind}
            activityName={displayName}
          />
        </TabsContent>
        <TabsContent value="tests" className="p-4">
          <ActivityTestsTab activity={activity} />
        </TabsContent>
      </div>

      {/* ───── Footer: always-visible About strip ─────────────────── */}
      <AboutFooter activity={activity} descriptor={descriptor} />
    </Tabs>
  );
}

// -- Configuration tab body -----------------------------------------------

function ConfigurationSections({
  activity,
  descriptor,
  kind,
  activityName,
}: {
  activity: ActivityJson;
  descriptor: ActivityDescriptor | null;
  kind: ActivityDescriptor["kind"] | undefined;
  activityName: string;
}) {
  const numInputs = (descriptor?.inputs ?? []).filter((i) => i.isBrowsable !== false).length;
  const numOutputs = (descriptor?.outputs ?? []).filter((o) => o.isBrowsable !== false).length;
  const isSubWorkflow = isWorkflowDefinitionActivity(activity);

  return (
    <div className="flex flex-col gap-2">
      {isSubWorkflow ? <WorkflowVersionCard activity={activity} /> : null}
      {numInputs > 0 ? (
        <ModalCard
          title="Inputs"
          helper={`${numInputs} ${numInputs === 1 ? "property" : "properties"} to bind or set.`}
          Icon={ArrowDownToLine}
          tone="sky"
          count={numInputs}
          dialogTitle={`Inputs · ${activityName}`}
          dialogDescription="Set literal values or bind to variables and expressions."
        >
          <ActivityInputsTab activity={activity} descriptor={descriptor} />
        </ModalCard>
      ) : null}
      {numOutputs > 0 ? (
        <ModalCard
          title="Outputs"
          helper={`${numOutputs} ${numOutputs === 1 ? "value" : "values"} to bind to variables.`}
          Icon={ArrowUpFromLine}
          tone="emerald"
          count={numOutputs}
          dialogTitle={`Outputs · ${activityName}`}
          dialogDescription="Choose a variable or workflow output to receive each value."
        >
          <ActivityOutputsTab activity={activity} descriptor={descriptor} />
        </ModalCard>
      ) : null}
      <SectionCard
        title="Identity"
        helper="Name, description and entry-point flags."
        Icon={Workflow}
        tone="violet"
        defaultOpen
      >
        <ActivityCommonTab activity={activity} />
      </SectionCard>
      <SectionCard
        title="Resilience"
        helper="Retry / fallback strategy on fault."
        Icon={ShieldCheck}
        tone="amber"
      >
        <ActivityResilienceTab activity={activity} />
      </SectionCard>
      <SectionCard
        title="Commit strategy"
        helper="When workflow state is saved."
        Icon={HardDriveDownload}
        tone="slate"
      >
        <ActivityCommitStrategyTab activity={activity} />
      </SectionCard>
      <SectionCard
        title="Log persistence"
        helper="Per-property persistence in the execution log."
        Icon={ScrollText}
        tone="slate"
      >
        <ActivityLogPersistenceTab activity={activity} />
      </SectionCard>
      {kind === "Task" ? (
        <SectionCard
          title="Task"
          helper="Background execution behaviour."
          Icon={Zap}
          tone="emerald"
        >
          <ActivityTaskTab activity={activity} />
        </SectionCard>
      ) : null}
    </div>
  );
}

// -- Card that opens its content in a centred modal ------------------------

const MODAL_TONES: Record<
  "sky" | "emerald" | "violet" | "amber" | "rose" | "slate",
  { bg: string; fg: string }
> = {
  sky: { bg: "bg-sky-500/12", fg: "text-sky-600 dark:text-sky-400" },
  emerald: { bg: "bg-emerald-500/12", fg: "text-emerald-600 dark:text-emerald-400" },
  violet: { bg: "bg-violet-500/12", fg: "text-violet-600 dark:text-violet-400" },
  amber: { bg: "bg-amber-500/12", fg: "text-amber-600 dark:text-amber-400" },
  rose: { bg: "bg-rose-500/12", fg: "text-rose-600 dark:text-rose-400" },
  slate: { bg: "bg-slate-500/12", fg: "text-slate-600 dark:text-slate-400" },
};

function ModalCard({
  title,
  helper,
  Icon,
  tone,
  count,
  dialogTitle,
  dialogDescription,
  children,
}: {
  title: string;
  helper?: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof MODAL_TONES;
  count?: number;
  dialogTitle: string;
  dialogDescription?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const tint = MODAL_TONES[tone];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left shadow-sm transition-all hover:border-foreground/15 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
      >
        <span
          className={["flex size-7 shrink-0 items-center justify-center rounded-md", tint.bg, tint.fg].join(" ")}
        >
          <Icon className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{title}</span>
            {typeof count === "number" ? (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-px text-2xs font-medium tabular-nums">
                {count}
              </span>
            ) : null}
          </div>
          {helper ? (
            <p className="text-muted-foreground truncate text-xs">{helper}</p>
          ) : null}
        </div>
        <ChevronRight className="text-muted-foreground/70 group-hover:text-foreground size-4 shrink-0 transition-colors" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(90vh,900px)] flex-col gap-0 p-0 sm:w-[min(94vw,1280px)] sm:max-w-[min(94vw,1280px)]">
          <DialogHeader className="shrink-0 border-b px-5 pt-4 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <span
                className={["flex size-6 items-center justify-center rounded-md", tint.bg, tint.fg].join(" ")}
              >
                <Icon className="size-3.5" />
              </span>
              {dialogTitle}
            </DialogTitle>
            {dialogDescription ? (
              <DialogDescription>{dialogDescription}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// -- Footer ---------------------------------------------------------------

function AboutFooter({
  activity,
  descriptor,
}: {
  activity: ActivityJson;
  descriptor: ActivityDescriptor | null;
}) {
  const typeShort = (descriptor?.displayName ?? activity.type.split(".").at(-1) ?? "").trim();
  const versionActivity = typeof activity.version === "number" ? activity.version : null;
  const versionDescriptor = descriptor?.version ?? null;
  const isStale =
    versionActivity != null && versionDescriptor != null && versionActivity < versionDescriptor;

  return (
    <footer className="bg-muted/40 text-muted-foreground flex items-center gap-2 border-t px-4 py-2 text-xs">
      <span className="text-foreground truncate font-medium" title={activity.type}>
        {typeShort}
      </span>
      {descriptor?.kind ? (
        <>
          <span aria-hidden>·</span>
          <span>{descriptor.kind}</span>
        </>
      ) : null}
      {versionActivity != null ? (
        <>
          <span aria-hidden>·</span>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className={[
                    "inline-flex items-center gap-1 font-mono",
                    isStale ? "text-amber-600 dark:text-amber-400" : "",
                  ].join(" ")}
                />
              }
            >
              {isStale ? (
                <span
                  aria-hidden
                  className="bg-amber-500 inline-block size-1.5 rounded-full"
                />
              ) : null}
              v{versionActivity}
            </TooltipTrigger>
            <TooltipContent>
              {isStale
                ? `Activity uses v${versionActivity}; latest descriptor is v${versionDescriptor}.`
                : `Descriptor version ${versionActivity}.`}
            </TooltipContent>
          </Tooltip>
        </>
      ) : null}
    </footer>
  );
}

// -- Empty state ---------------------------------------------------------

function EmptyState() {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="bg-muted/60 ring-border flex size-16 items-center justify-center rounded-full ring-1">
        <MousePointerSquareDashed className="size-7 opacity-50" />
      </div>
      <div className="space-y-1.5">
        <p className="text-foreground text-sm font-semibold">Nothing selected</p>
        <p className="text-muted-foreground max-w-[30ch] text-xs leading-relaxed">
          Click any activity on the canvas to inspect its inputs, outputs, and
          settings.
        </p>
      </div>
    </div>
  );
}

/**
 * Read-only details for a State Machine state. Phase A — adding/removing
 * states, renaming, and editing entry/exit slots happens in Phase B/C.
 *
 * The metadata shown here is derived from the root's `initialState`,
 * `currentState`, and `transitions[]` (terminal = zero out-degree), so the
 * panel stays in sync with the JSON as the user navigates.
 */
function StateDetailsPanel({
  state,
  root,
  readOnly,
}: {
  state: StateMachineState;
  root: ActivityJson;
  readOnly: boolean;
}) {
  const transitions = (root.transitions as StateMachineTransition[] | undefined) ?? [];
  const isInitial = root.initialState === state.name;
  const isCurrent = root.currentState === state.name;
  const outgoing = transitions.filter((t) => t.from === state.name);
  const incoming = transitions.filter((t) => t.to === state.name);
  const isTerminal = outgoing.length === 0;
  const slotOps = useSlotOps(root);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b" style={{ background: "var(--panel-surface)" }}>
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg ring-1 ring-black/5 dark:ring-white/5">
            <GitMerge className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-semibold">{state.name}</p>
            <p className="text-muted-foreground text-xs">State</p>
          </div>
        </div>
      </header>

      <div className="bg-background min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          {state.description ? (
            <section>
              <SectionLabel>Description</SectionLabel>
              <p className="text-foreground text-xs leading-relaxed">{state.description}</p>
            </section>
          ) : null}

          <section className="flex flex-wrap gap-1.5">
            {isInitial ? <DetailChip tone="emerald">Initial</DetailChip> : null}
            {isCurrent && !isInitial ? <DetailChip tone="emerald">Current</DetailChip> : null}
            {isTerminal ? <DetailChip tone="muted">Terminal</DetailChip> : null}
          </section>

          <section>
            <SectionLabel>Entry</SectionLabel>
            {state.entry ? (
              <SlotRow
                activity={state.entry}
                readOnly={readOnly}
                onEdit={() =>
                  slotOps.drill(
                    `state:${state.name}:entry`,
                    `${state.name} · entry`,
                  )
                }
                onRemove={() =>
                  slotOps.remove(`state:${state.name}:entry`)
                }
              />
            ) : (
              <EmptySlotButton
                label="entry"
                readOnly={readOnly}
                onPick={(anchor) =>
                  slotOps.openPicker(
                    `state:${state.name}:entry`,
                    `${state.name} · entry`,
                    anchor,
                  )
                }
              />
            )}
          </section>

          <section>
            <SectionLabel>Exit</SectionLabel>
            {state.exit ? (
              <SlotRow
                activity={state.exit}
                readOnly={readOnly}
                onEdit={() =>
                  slotOps.drill(
                    `state:${state.name}:exit`,
                    `${state.name} · exit`,
                  )
                }
                onRemove={() => slotOps.remove(`state:${state.name}:exit`)}
              />
            ) : (
              <EmptySlotButton
                label="exit"
                readOnly={readOnly}
                onPick={(anchor) =>
                  slotOps.openPicker(
                    `state:${state.name}:exit`,
                    `${state.name} · exit`,
                    anchor,
                  )
                }
              />
            )}
          </section>

          <section>
            <SectionLabel>Transitions in</SectionLabel>
            {incoming.length === 0 ? (
              <p className="text-muted-foreground text-xs">None.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {incoming.map((t, i) => (
                  <TransitionRow key={`in-${i}`} transition={t} side="from" />
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionLabel>Transitions out</SectionLabel>
            {outgoing.length === 0 ? (
              <p className="text-muted-foreground text-xs">None.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {outgoing.map((t, i) => (
                  <TransitionRow key={`out-${i}`} transition={t} side="to" />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      {slotOps.menu}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-1 text-2xs font-medium uppercase tracking-wide">
      {children}
    </p>
  );
}

function DetailChip({
  tone,
  children,
}: {
  tone: "emerald" | "muted";
  children: React.ReactNode;
}) {
  const cls =
    tone === "emerald"
      ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
      : "border-border text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-md border bg-background px-1.5 py-0.5 text-xs font-medium ${cls}`}
    >
      {children}
    </span>
  );
}

function SlotRow({
  activity,
  onEdit,
  onRemove,
  readOnly,
}: {
  activity: ActivityJson;
  onEdit?: () => void;
  onRemove?: () => void;
  readOnly?: boolean;
}) {
  const short = activity.type.split(".").at(-1) ?? activity.type;
  return (
    <div className="bg-card border-border group flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
      <Workflow className="text-muted-foreground size-3.5" />
      <span className="font-medium">{short}</span>
      <span className="text-muted-foreground font-mono text-xs">{activity.type}</span>
      {!readOnly && (onEdit || onRemove) ? (
        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit this slot"
              aria-label="Edit this slot"
              onClick={onEdit}
            >
              <Sliders className="size-3" />
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Remove this slot"
              aria-label="Remove this slot"
              onClick={onRemove}
            >
              <Trash2 className="size-3" />
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Centralises the three actions a State-Machine slot UI needs:
 *  - `drill(port, label)` — enter the slot via `containerStack` so the canvas
 *    re-renders at the slot's activity.
 *  - `remove(port)` — clear the slot.
 *  - `openPicker(port, label, anchor)` — pop a ConnectMenu at `anchor`; on
 *    pick, create a stub activity, write it to the slot, and drill in.
 *
 * The returned `menu` is the floating ConnectMenu element (or `null` when
 * closed). Callers render it inside their root container so click-outside
 * detection works.
 */
function useSlotOps(root: ActivityJson): {
  drill: (port: string, label: string) => void;
  remove: (port: string) => void;
  openPicker: (port: string, label: string, anchor: { x: number; y: number }) => void;
  menu: React.ReactNode;
} {
  const pushSnapshot = useEditorStore((s) => s.pushSnapshot);
  const setContainerRoot = useEditorStore((s) => s.setContainerRoot);
  const enterContainerByPort = useEditorStore((s) => s.enterContainerByPort);
  const descriptors = useActivityDescriptors();
  const [picker, setPicker] = useState<
    | { port: string; label: string; x: number; y: number }
    | null
  >(null);

  const drill = (port: string, label: string) =>
    enterContainerByPort(root.id, port, label);

  const remove = (port: string) => {
    pushSnapshot();
    setContainerRoot(setEmbeddedChildren(root, { name: port }, []));
  };

  const openPicker = (port: string, label: string, anchor: { x: number; y: number }) =>
    setPicker({ port, label, x: anchor.x, y: anchor.y });

  const onPick = (descriptor: ActivityDescriptor) => {
    if (!picker) return;
    pushSnapshot();
    const stub = makeActivity(
      descriptor.typeName,
      descriptor,
      null,
      root.nodeId ?? "",
      root,
    );
    const nextRoot = setEmbeddedChildren(root, { name: picker.port }, [stub]);
    setContainerRoot(nextRoot);
    enterContainerByPort(root.id, picker.port, picker.label);
    setPicker(null);
  };

  void descriptors; // ConnectMenu calls useActivityDescriptors internally.

  const menu = picker ? (
    <ConnectMenu
      clientX={picker.x}
      clientY={picker.y}
      onPick={onPick}
      onClose={() => setPicker(null)}
    />
  ) : null;

  return { drill, remove, openPicker, menu };
}

/**
 * "+ Add" button for a missing State-Machine slot. Clicking opens a small
 * floating ConnectMenu anchored at the button. Picking an activity creates
 * the stub, writes it to the slot, and drills into it so the user can
 * immediately configure its inputs.
 */
function EmptySlotButton({
  label,
  onPick,
  readOnly,
}: {
  label: string;
  onPick: (anchor: { x: number; y: number }) => void;
  readOnly?: boolean;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  if (readOnly) {
    return <p className="text-muted-foreground text-xs">No {label}.</p>;
  }
  return (
    <Button
      ref={ref}
      variant="outline"
      size="xs"
      onClick={() => {
        const r = ref.current?.getBoundingClientRect();
        onPick(r ? { x: r.left, y: r.bottom } : { x: 100, y: 100 });
      }}
    >
      <Plus className="size-3" /> Add {label}
    </Button>
  );
}

function TransitionRow({
  transition,
  side,
}: {
  transition: StateMachineTransition;
  side: "from" | "to";
}) {
  const label = transition.displayName?.trim() || transition.name?.trim() || "(unnamed)";
  const counterpart = side === "from" ? transition.from : transition.to;
  const arrow = side === "from" ? "←" : "→";
  return (
    <li className="bg-card border-border flex items-baseline gap-2 rounded-md border px-2 py-1 text-xs">
      <span className="text-muted-foreground tabular-nums">{arrow}</span>
      <span className="font-medium">{counterpart}</span>
      <span className="text-muted-foreground truncate">{label}</span>
    </li>
  );
}

/**
 * Editable details for a selected State Machine transition. Name / displayName
 * commit on blur or Enter; the From / To selects offer every existing state
 * (and the writes go through the store's `updateStateMachineTransition`,
 * which rejects refs to unknown states). The trash icon deletes the
 * transition; the panel reverts to the empty state.
 *
 * Phase C will add inline editing for `condition` / `trigger` / `action` —
 * for now those still render read-only summaries.
 */
function TransitionDetailsPanel({
  transition,
  transitionIndex,
  root,
  readOnly,
}: {
  transition: StateMachineTransition;
  transitionIndex: number;
  root: ActivityJson;
  readOnly: boolean;
}) {
  const updateTransition = useEditorStore((s) => s.updateStateMachineTransition);
  const removeTransition = useEditorStore(
    (s) => s.removeStateMachineTransitionByIndex,
  );
  const label = transition.displayName?.trim() || transition.name?.trim() || "(unnamed)";
  const conditionLabel = describeCondition(transition.condition);
  const states =
    (root.states as Array<{ name: string }> | undefined) ?? [];
  const slotOps = useSlotOps(root);

  // Local drafts for the free-text fields so typing is smooth; commit on
  // blur (or Enter). Re-seed when the upstream value changes (after undo
  // or a sibling field edit).
  const [nameDraft, setNameDraft] = useState(transition.name ?? "");
  const [displayDraft, setDisplayDraft] = useState(transition.displayName ?? "");
  useEffect(() => setNameDraft(transition.name ?? ""), [transition.name]);
  useEffect(
    () => setDisplayDraft(transition.displayName ?? ""),
    [transition.displayName],
  );

  const commitName = () => {
    const trimmed = nameDraft.trim();
    const nextName = trimmed === "" ? null : trimmed;
    if (nextName !== (transition.name ?? null)) {
      updateTransition(transitionIndex, { name: nextName });
    }
  };
  const commitDisplay = () => {
    const trimmed = displayDraft.trim();
    const nextDisplay = trimmed === "" ? null : trimmed;
    if (nextDisplay !== (transition.displayName ?? null)) {
      updateTransition(transitionIndex, { displayName: nextDisplay });
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="border-b" style={{ background: "var(--panel-surface)" }}>
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg ring-1 ring-black/5 dark:ring-white/5">
            <ChevronRight className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-semibold">{label}</p>
            <p className="text-muted-foreground text-xs">Transition</p>
          </div>
          {!readOnly ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete transition"
              title="Delete transition"
              onClick={() => removeTransition(transitionIndex)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </header>

      <div className="bg-background min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-1.5">
            <SectionLabel>Endpoints</SectionLabel>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <select
                value={transition.from}
                disabled={readOnly}
                onChange={(e) =>
                  updateTransition(transitionIndex, { from: e.target.value })
                }
                className="border-input bg-background h-8 rounded-md border px-2 text-xs outline-none focus-visible:border-primary"
              >
                {states.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">→</span>
              <select
                value={transition.to}
                disabled={readOnly}
                onChange={(e) =>
                  updateTransition(transitionIndex, { to: e.target.value })
                }
                className="border-input bg-background h-8 rounded-md border px-2 text-xs outline-none focus-visible:border-primary"
              >
                {states.map((st) => (
                  <option key={st.name} value={st.name}>
                    {st.name}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="flex flex-col gap-1.5">
            <SectionLabel>Display name</SectionLabel>
            <input
              type="text"
              value={displayDraft}
              disabled={readOnly}
              onChange={(e) => setDisplayDraft(e.target.value)}
              onBlur={commitDisplay}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="(unnamed)"
              className="border-input bg-background h-8 rounded-md border px-2 text-xs outline-none focus-visible:border-primary"
            />
          </section>

          <section className="flex flex-col gap-1.5">
            <SectionLabel>Internal name</SectionLabel>
            <input
              type="text"
              value={nameDraft}
              disabled={readOnly}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="optional"
              className="border-input bg-background font-mono h-8 rounded-md border px-2 text-xs outline-none focus-visible:border-primary"
            />
          </section>

          <section className="flex flex-col gap-1.5">
            <SectionLabel>Condition</SectionLabel>
            <TransitionConditionEditor
              transitionIndex={transitionIndex}
              condition={transition.condition}
              readOnly={readOnly}
            />
            {conditionLabel ? (
              <p className="text-muted-foreground text-xs">{conditionLabel}</p>
            ) : null}
          </section>

          <section>
            <SectionLabel>Trigger</SectionLabel>
            {transition.trigger ? (
              <SlotRow
                activity={transition.trigger}
                readOnly={readOnly}
                onEdit={() =>
                  slotOps.drill(
                    `transition:${transitionIndex}:trigger`,
                    `${label} · trigger`,
                  )
                }
                onRemove={() =>
                  slotOps.remove(`transition:${transitionIndex}:trigger`)
                }
              />
            ) : (
              <EmptySlotButton
                label="trigger"
                readOnly={readOnly}
                onPick={(anchor) =>
                  slotOps.openPicker(
                    `transition:${transitionIndex}:trigger`,
                    `${label} · trigger`,
                    anchor,
                  )
                }
              />
            )}
          </section>

          <section>
            <SectionLabel>Action</SectionLabel>
            {transition.action ? (
              <SlotRow
                activity={transition.action}
                readOnly={readOnly}
                onEdit={() =>
                  slotOps.drill(
                    `transition:${transitionIndex}:action`,
                    `${label} · action`,
                  )
                }
                onRemove={() =>
                  slotOps.remove(`transition:${transitionIndex}:action`)
                }
              />
            ) : (
              <EmptySlotButton
                label="action"
                readOnly={readOnly}
                onPick={(anchor) =>
                  slotOps.openPicker(
                    `transition:${transitionIndex}:action`,
                    `${label} · action`,
                    anchor,
                  )
                }
              />
            )}
          </section>
        </div>
      </div>
      {slotOps.menu}
    </div>
  );
}

/**
 * Three-state condition picker: Always / Never / Expression. Activity-typed
 * conditions (the Expression option) are read-only here — they keep their
 * existing value and switching back to Always/Never replaces the activity.
 * Phase C will add a Monaco expression editor for the Expression branch.
 */
function TransitionConditionEditor({
  transitionIndex,
  condition,
  readOnly,
}: {
  transitionIndex: number;
  condition: StateMachineTransition["condition"];
  readOnly: boolean;
}) {
  const updateTransition = useEditorStore((s) => s.updateStateMachineTransition);
  const value: "always" | "never" | "expression" =
    condition === true
      ? "always"
      : condition === false
        ? "never"
        : condition && typeof condition === "object"
          ? "expression"
          : "always";
  return (
    <select
      value={value}
      disabled={readOnly}
      onChange={(e) => {
        const next = e.target.value as "always" | "never" | "expression";
        if (next === "always") {
          updateTransition(transitionIndex, { condition: true });
        } else if (next === "never") {
          updateTransition(transitionIndex, { condition: false });
        }
        // Switching to "expression" doesn't synthesise a stub — the user
        // edits the existing condition activity via the slot UI (Phase C).
      }}
      className="border-input bg-background h-8 rounded-md border px-2 text-xs outline-none focus-visible:border-primary"
    >
      <option value="always">Always fires</option>
      <option value="never">Never fires</option>
      <option value="expression" disabled={!(condition && typeof condition === "object")}>
        Expression
      </option>
    </select>
  );
}

function describeCondition(
  condition: StateMachineTransition["condition"],
): string | null {
  if (condition == null) return null;
  if (condition === true) return "Always (true).";
  if (condition === false) return "Never (false).";
  if (typeof condition === "object" && condition && "type" in condition) {
    const short = (condition.type as string).split(".").at(-1);
    return `Expression activity: ${short}`;
  }
  return null;
}

// -- Activity id line with click-to-copy ------------------------------------

function ActivityIdLine({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Ignore — clipboard may be unavailable in some embeds.
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title={copied ? "Copied" : `Copy id: ${id}`}
      className="text-muted-foreground hover:text-foreground group inline-flex max-w-full items-center gap-1 font-mono text-2xs transition-colors"
    >
      <span className="truncate">{id}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-emerald-500" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />
      )}
    </button>
  );
}

// -- Inline rename ---------------------------------------------------------

function InlineNameEditor({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (next: string) => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing) {
    return (
      <button
        type="button"
        disabled={readOnly}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className={[
          "-mx-1 block max-w-full truncate rounded px-1 text-left text-base font-semibold leading-snug tracking-tight",
          readOnly ? "cursor-default" : "hover:bg-muted/70 cursor-text",
        ].join(" ")}
        title={readOnly ? value : "Click to rename"}
      >
        {value}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft.trim() && draft.trim() !== value) onChange(draft.trim());
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
        }
      }}
      className="-mx-1 h-8 px-1 text-base font-semibold"
    />
  );
}

// -- Header kebab ----------------------------------------------------------

function ActivityActions({
  isTrigger,
  disabled,
  onToggleStart,
  onDuplicate,
  onRemove,
}: {
  isTrigger: boolean;
  disabled: boolean;
  onToggleStart: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Activity actions"
            disabled={disabled}
          />
        }
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onToggleStart}>
          <GitMerge className="size-3.5" />
          {isTrigger ? "Toggle trigger" : "Toggle starting point"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy className="size-3.5" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2 className="size-3.5" /> Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// -- Pure helpers ----------------------------------------------------------

function setMetadataDisplayText(
  root: ActivityJson,
  id: string,
  displayText: string,
): ActivityJson {
  if (root.id === id) {
    return {
      ...root,
      metadata: {
        ...(root.metadata ?? {}),
        displayText,
      },
    };
  }
  let changed = false;
  const next: Record<string, unknown> = { ...root };
  for (const [k, v] of Object.entries(root)) {
    if (k === "metadata") continue;
    if (Array.isArray(v)) {
      const arr = v.map((item) => {
        if (looksLikeActivity(item)) {
          const updated = setMetadataDisplayText(item, id, displayText);
          if (updated !== item) changed = true;
          return updated;
        }
        return item;
      });
      if (changed) next[k] = arr;
    } else if (looksLikeActivity(v)) {
      const updated = setMetadataDisplayText(v, id, displayText);
      if (updated !== v) {
        next[k] = updated;
        changed = true;
      }
    }
  }
  return changed ? (next as ActivityJson) : root;
}

function looksLikeActivity(x: unknown): x is ActivityJson {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { type?: unknown }).type === "string"
  );
}

