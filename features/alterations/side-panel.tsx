"use client";

import { format } from "date-fns";
import {
  ChevronRight,
  Layers,
  Pencil,
  Search,
  Trash2,
  Wand2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  ALTERATION_CATALOG,
  descriptorsForTarget,
  tintClasses,
  type AlterationDescriptor,
} from "@/features/alterations/catalog";
import { ConfigDialog } from "@/features/alterations/config-dialog";
import {
  summariseConfig,
  toAlterationJson,
  useStagingStore,
  type StagedAlteration,
} from "@/features/alterations/staging-store";
import { SubmitDialog } from "@/features/alterations/submit-dialog";
import { ConfirmDialog } from "@/features/workflows/confirm-dialog";
import { useDebouncedValue } from "@/features/workflows/use-debounced";
import { useDryRunAlterations } from "@/lib/api/alterations";
import { useWorkflowInstanceState } from "@/lib/api/elsa";
import type {
  VariableDefinition,
  WorkflowInstanceSummary,
} from "@/lib/api/types";
import type { SelectedActivity } from "./designer-host";

type Editing =
  | { mode: "create"; descriptor: AlterationDescriptor; activity?: SelectedActivity; initialValues?: Record<string, string> }
  | { mode: "edit"; staged: StagedAlteration }
  | null;

export function SidePanel({
  instance,
  definitionId,
  definitionVariables,
  selectedActivity,
}: {
  instance: WorkflowInstanceSummary;
  definitionId: string;
  definitionVariables: VariableDefinition[];
  selectedActivity: SelectedActivity | null;
}) {
  const items = useStagingStore((s) => s.items);
  const add = useStagingStore((s) => s.add);
  const update = useStagingStore((s) => s.update);
  const remove = useStagingStore((s) => s.remove);
  const clear = useStagingStore((s) => s.clear);

  const [tab, setTab] = useState<"selection" | "variables" | "plan">("selection");
  const [editing, setEditing] = useState<Editing>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  // Auto-switch to "plan" when a new item is staged.
  const lastCount = useRef(items.length);
  useEffect(() => {
    if (items.length > lastCount.current) setTab("plan");
    lastCount.current = items.length;
  }, [items.length]);

  const stateQ = useWorkflowInstanceState(instance.id);
  const liveVariables: Record<string, unknown> = useMemo(
    () => (stateQ.data?.variables ?? {}) as Record<string, unknown>,
    [stateQ.data?.variables],
  );
  const liveVarCount = Object.keys(liveVariables).length;

  const handleDescriptorClick = useCallback(
    (descriptor: AlterationDescriptor) => {
      if (!descriptor.fields || descriptor.fields.length === 0) {
        // Stage immediately.
        const staged: StagedAlteration = {
          id: crypto.randomUUID(),
          descriptor,
          targetActivityId:
            descriptor.target === "Activity"
              ? selectedActivity?.id
              : undefined,
          targetActivityDisplayName:
            descriptor.target === "Activity"
              ? selectedActivity?.displayName
              : undefined,
          configValues: {},
        };
        add(staged);
        return;
      }
      setEditing({
        mode: "create",
        descriptor,
        activity:
          descriptor.target === "Activity" && selectedActivity
            ? selectedActivity
            : undefined,
      });
    },
    [add, selectedActivity],
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="flex h-full min-h-0 flex-1 flex-col"
      >
        <div className="border-b px-3 py-2">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="selection">Selection</TabsTrigger>
            <TabsTrigger value="variables" className="gap-1.5">
              Variables
              {liveVarCount > 0 ? (
                <Badge variant="secondary" className="text-[10px]">
                  {liveVarCount}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-1.5">
              Plan
              {items.length > 0 ? (
                <Badge variant="secondary" className="text-[10px]">
                  {items.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="selection" className="min-h-0 overflow-y-auto p-3">
          <SelectionTab
            instance={instance}
            selectedActivity={selectedActivity}
            onPick={handleDescriptorClick}
          />
        </TabsContent>

        <TabsContent value="variables" className="min-h-0 overflow-y-auto p-3">
          <VariablesTab
            definitionVariables={definitionVariables}
            liveVariables={liveVariables}
            isLoading={stateQ.isPending}
            onModify={(variableId, currentValue) => {
              const descriptor = ALTERATION_CATALOG.find(
                (d) => d.typeId === "ModifyVariable",
              );
              if (!descriptor) return;
              setEditing({
                mode: "create",
                descriptor,
                initialValues: {
                  variableId,
                  value:
                    currentValue !== undefined
                      ? JSON.stringify(currentValue)
                      : "",
                },
              });
            }}
          />
        </TabsContent>

        <TabsContent value="plan" className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <PlanTab
              items={items}
              onEdit={(s) => setEditing({ mode: "edit", staged: s })}
              onRemove={remove}
            />
          </div>
          <PlanFooter
            instanceId={instance.id}
            disabled={items.length === 0}
            onSubmit={() => setSubmitOpen(true)}
            onDiscard={() => setDiscardOpen(true)}
          />
        </TabsContent>
      </Tabs>

      {editing ? (
        <ConfigDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          definitionId={definitionId}
          definitionVariables={definitionVariables}
          liveVariables={liveVariables}
          descriptor={
            editing.mode === "create" ? editing.descriptor : editing.staged.descriptor
          }
          targetActivity={
            editing.mode === "create"
              ? editing.activity
              : editing.staged.targetActivityId
                ? {
                    id: editing.staged.targetActivityId,
                    displayName: editing.staged.targetActivityDisplayName ?? editing.staged.targetActivityId,
                  }
                : undefined
          }
          initialValues={
            editing.mode === "create"
              ? editing.initialValues ?? {}
              : editing.staged.configValues
          }
          onSubmit={(values) => {
            if (editing.mode === "create") {
              add({
                id: crypto.randomUUID(),
                descriptor: editing.descriptor,
                targetActivityId:
                  editing.descriptor.target === "Activity"
                    ? editing.activity?.id
                    : undefined,
                targetActivityDisplayName:
                  editing.descriptor.target === "Activity"
                    ? editing.activity?.displayName
                    : undefined,
                configValues: values,
              });
            } else {
              update({ ...editing.staged, configValues: values });
            }
            setEditing(null);
          }}
        />
      ) : null}

      {submitOpen ? (
        <SubmitDialog
          open
          onOpenChange={setSubmitOpen}
          instanceId={instance.id}
          items={items}
          onSuccess={() => clear()}
        />
      ) : null}

      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard staged alterations?"
        description="All draft alterations on this instance will be removed. This cannot be undone."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={() => {
          clear();
          setDiscardOpen(false);
        }}
      />
    </div>
  );
}

function SelectionTab({
  instance,
  selectedActivity,
  onPick,
}: {
  instance: WorkflowInstanceSummary;
  selectedActivity: SelectedActivity | null;
  onPick: (d: AlterationDescriptor) => void;
}) {
  if (selectedActivity) {
    const activityDescriptors = descriptorsForTarget("Activity");
    return (
      <div className="space-y-4">
        <MetadataBlock
          title="Activity"
          rows={[
            { label: "Name", value: selectedActivity.displayName },
            { label: "Id", value: selectedActivity.id, mono: true },
            ...(selectedActivity.type
              ? [{ label: "Type", value: selectedActivity.type, mono: true }]
              : []),
          ]}
        />
        <DescriptorList descriptors={activityDescriptors} onPick={onPick} />
      </div>
    );
  }

  const instanceDescriptors = descriptorsForTarget("Instance");
  return (
    <div className="space-y-4">
      <MetadataBlock
        title="Instance"
        rows={[
          { label: "Name", value: instance.name ?? "—" },
          { label: "Id", value: instance.id, mono: true },
          { label: "Status", value: instance.subStatus },
          {
            label: "Created",
            value: format(new Date(instance.createdAt), "yyyy-MM-dd HH:mm"),
          },
        ]}
      />
      <p className="text-muted-foreground text-xs">
        Click an activity in the canvas to see activity-targeted actions.
      </p>
      <DescriptorList descriptors={instanceDescriptors} onPick={onPick} />
    </div>
  );
}

function MetadataBlock({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string; mono?: boolean }[];
}) {
  return (
    <div className="bg-muted/40 rounded-md border p-3">
      <p className="text-muted-foreground mb-2 text-[10px] font-semibold uppercase tracking-wide">
        {title}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd
              className={
                r.mono
                  ? "font-mono text-foreground/90 truncate"
                  : "text-foreground/90 truncate"
              }
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function DescriptorList({
  descriptors,
  onPick,
}: {
  descriptors: AlterationDescriptor[];
  onPick: (d: AlterationDescriptor) => void;
}) {
  if (descriptors.length === 0) {
    return (
      <p className="text-muted-foreground text-xs italic">
        No actions for this target.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {descriptors.map((d) => {
        const t = tintClasses(d.tint);
        const Icon = d.icon;
        return (
          <button
            key={d.typeId}
            type="button"
            onClick={() => onPick(d)}
            className="group/action hover:bg-muted/60 relative flex items-start gap-3 overflow-hidden rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-border"
          >
            <span
              aria-hidden
              className={["absolute inset-y-1 left-0 w-1 rounded-r-sm", t.accent].join(" ")}
            />
            <span
              className={[
                "ml-1 flex size-7 shrink-0 items-center justify-center rounded-md",
                t.bg,
                t.fg,
              ].join(" ")}
            >
              <Icon className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{d.displayName}</span>
              <span className="text-muted-foreground text-xs">
                {d.description}
              </span>
            </span>
            <ChevronRight className="text-muted-foreground/50 mt-1 size-3.5 shrink-0 group-hover/action:text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

function VariablesTab({
  definitionVariables,
  liveVariables,
  isLoading,
  onModify,
}: {
  definitionVariables: VariableDefinition[];
  liveVariables: Record<string, unknown>;
  isLoading: boolean;
  onModify: (variableId: string, currentValue: unknown) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 200);

  // The wire format keys variables by name; merge live values onto the
  // definition list so disabled / unset variables still surface in the picker.
  const merged = useMemo(() => {
    const byName = new Map<string, { name: string; value: unknown; id: string }>();
    for (const v of definitionVariables) {
      byName.set(v.name, { name: v.name, value: undefined, id: v.id });
    }
    for (const [name, value] of Object.entries(liveVariables)) {
      const existing = byName.get(name);
      if (existing) existing.value = value;
      else byName.set(name, { name, value, id: name });
    }
    const q = debounced.trim().toLowerCase();
    const list = Array.from(byName.values());
    return q ? list.filter((v) => v.name.toLowerCase().includes(q)) : list;
  }, [definitionVariables, liveVariables, debounced]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search variables…"
          className="h-8 pl-8 text-sm"
        />
      </div>
      {isLoading ? (
        <p className="text-muted-foreground text-xs italic">Loading variables…</p>
      ) : merged.length === 0 ? (
        <p className="text-muted-foreground text-xs italic">
          {debounced ? `No variables match "${debounced}".` : "No variables on this workflow."}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {merged.map((v) => (
            <div
              key={v.id}
              className="hover:bg-muted/40 flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{v.name}</p>
                <p className="text-muted-foreground truncate font-mono text-[11px]">
                  {v.value === undefined
                    ? "(unset)"
                    : truncate(JSON.stringify(v.value), 60)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onModify(v.id, v.value)}
              >
                <Pencil className="size-3" />
                Modify
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanTab({
  items,
  onEdit,
  onRemove,
}: {
  items: StagedAlteration[];
  onEdit: (s: StagedAlteration) => void;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-8 text-center text-xs">
        <Layers className="text-muted-foreground/60 size-6" />
        <p>No alterations staged yet.</p>
        <p>Pick an action from the Selection tab to add one.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((s) => (
        <StagingCard
          key={s.id}
          staged={s}
          onEdit={() => onEdit(s)}
          onRemove={() => onRemove(s.id)}
        />
      ))}
    </div>
  );
}

function StagingCard({
  staged,
  onEdit,
  onRemove,
}: {
  staged: StagedAlteration;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const t = tintClasses(staged.descriptor.tint);
  const Icon = staged.descriptor.icon;
  const targetLabel =
    staged.descriptor.target === "Activity"
      ? `Activity: ${staged.targetActivityDisplayName ?? staged.targetActivityId ?? "—"}`
      : staged.descriptor.target === "Variable"
        ? "Variable scope"
        : "Whole instance";
  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="relative flex items-start gap-3 p-3">
        <span
          aria-hidden
          className={["absolute inset-y-2 left-0 w-1 rounded-r-sm", t.accent].join(" ")}
        />
        <span
          className={[
            "ml-1 flex size-7 shrink-0 items-center justify-center rounded-md",
            t.bg,
            t.fg,
          ].join(" ")}
        >
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {staged.descriptor.displayName}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {targetLabel}
          </p>
          <p className="text-muted-foreground/80 mt-1 truncate text-xs">
            {summariseConfig(staged)}
          </p>
        </div>
        <div className="flex flex-col gap-1">
          {staged.descriptor.fields && staged.descriptor.fields.length > 0 ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Edit"
              onClick={onEdit}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Remove"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanFooter({
  instanceId,
  disabled,
  onSubmit,
  onDiscard,
}: {
  instanceId: string;
  disabled: boolean;
  onSubmit: () => void;
  onDiscard: () => void;
}) {
  const dryRun = useDryRunAlterations();
  const items = useStagingStore((s) => s.items);

  const runDryRun = async () => {
    try {
      const res = await dryRun.mutateAsync({
        emptyFilterSelectsAll: false,
        workflowInstanceIds: [instanceId],
      });
      toast.success(
        `Would target ${res.workflowInstanceIds.length} instance(s).`,
      );
    } catch {
      toast.error("Dry-run failed.");
    }
  };

  return (
    <div className="border-t bg-background px-3 py-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onDiscard}
          disabled={disabled || dryRun.isPending}
        >
          Discard
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={runDryRun}
          disabled={disabled || dryRun.isPending}
        >
          <Wand2 className="size-3.5" />
          {dryRun.isPending ? "Dry-run…" : "Dry-run"}
        </Button>
        <Button
          size="sm"
          className="ml-auto"
          onClick={onSubmit}
          disabled={disabled || items.some((i) => !configIsComplete(i))}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function configIsComplete(s: StagedAlteration): boolean {
  for (const f of s.descriptor.fields ?? []) {
    if (f.required && (s.configValues[f.key] ?? "") === "") return false;
  }
  // Sanity probe — ensure toAlterationJson would produce a usable shape.
  // (Returning the result has no cost; we just discard it.)
  toAlterationJson(s);
  return true;
}
