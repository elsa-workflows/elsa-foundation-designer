"use client";

import {
  AlertCircle,
  ArrowLeft,
  Layers,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DefinitionGraph } from "@/features/workflows/definition-graph";
import { SidePanel } from "@/features/alterations/side-panel";
import { useStagingStore } from "@/features/alterations/staging-store";
import {
  useWorkflowDefinition,
  useWorkflowInstance,
} from "@/lib/api/elsa";
import { useWorkflowInstanceLiveUpdates } from "@/lib/api/signalr";
import type { ActivityJson, WorkflowInstanceSummary } from "@/lib/api/types";

const MIN_PANEL = 320;
const MAX_PANEL_MARGIN = 280;
const DEFAULT_PANEL = 400;

export type SelectedActivity = {
  id: string;
  displayName: string;
  type?: string;
};

export function AlterationDesignerHost({ instanceId }: { instanceId: string }) {
  const inst = useWorkflowInstance(instanceId);
  useWorkflowInstanceLiveUpdates(instanceId);
  const definitionId =
    (inst.data as WorkflowInstanceSummary | undefined)?.definitionId;
  const defQ = useWorkflowDefinition(definitionId, "Latest");

  const [selected, setSelected] = useState<SelectedActivity | null>(null);
  const stagedCount = useStagingStore((s) => s.items.length);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL);

  const activityIndex = useMemo(() => {
    const map = new Map<string, ActivityJson>();
    if (defQ.data?.root) walkActivities(defQ.data.root, map);
    return map;
  }, [defQ.data]);

  const onActivityClick = useCallback(
    (id: string | null) => {
      if (!id) {
        setSelected(null);
        return;
      }
      const activity = activityIndex.get(id);
      setSelected({
        id,
        displayName: displayNameFor(activity) ?? id,
        type: activity?.type,
      });
    },
    [activityIndex],
  );

  if (inst.isPending || defQ.isPending) {
    return (
      <div className="text-muted-foreground flex h-[calc(100svh-3.5rem)] items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading instance…
      </div>
    );
  }

  if (inst.isError || !inst.data || defQ.isError || !defQ.data) {
    return (
      <div className="flex h-[calc(100svh-3.5rem)] items-center justify-center p-6">
        <Card className="max-w-md">
          <CardContent className="flex items-start gap-3 pt-6">
            <AlertCircle className="text-destructive size-5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Couldn&apos;t load this instance.
              </p>
              <p className="text-muted-foreground text-xs">
                Either the instance id is unknown or its definition is missing.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const instance = inst.data as WorkflowInstanceSummary;
  const title = instance.name?.trim() || instance.id;

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          render={<Link href="/alterations/instances" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Altering instance</span>
          </div>
          <h1 className="truncate text-sm font-semibold leading-tight">
            {title}
          </h1>
        </div>
        <SubStatusBadge subStatus={instance.subStatus} />
        {stagedCount > 0 ? (
          <Badge
            variant="secondary"
            className="ml-1 flex items-center gap-1 text-[11px]"
          >
            <Layers className="size-3" />
            {stagedCount} staged
          </Badge>
        ) : null}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={panelOpen ? "Hide panel" : "Show panel"}
          onClick={() => setPanelOpen((o) => !o)}
        >
          {panelOpen ? (
            <PanelRightClose className="size-4" />
          ) : (
            <PanelRightOpen className="size-4" />
          )}
        </Button>
      </div>

      <div
        className="grid flex-1 min-h-0"
        style={{
          gridTemplateColumns: panelOpen ? `1fr ${panelWidth}px` : "1fr 0px",
        }}
      >
        <section className="relative min-w-0 overflow-hidden border-r">
          <DefinitionGraph
            definition={defQ.data}
            onActivityClick={onActivityClick}
          />
        </section>
        <aside
          className={[
            "bg-background relative flex flex-col overflow-hidden",
            panelOpen ? "" : "hidden",
          ].join(" ")}
        >
          <PanelResizer
            onResize={(dx) =>
              setPanelWidth((w) => {
                const next = w - dx;
                const max = Math.max(
                  MIN_PANEL,
                  window.innerWidth - MAX_PANEL_MARGIN,
                );
                return Math.min(max, Math.max(MIN_PANEL, next));
              })
            }
            onReset={() => setPanelWidth(DEFAULT_PANEL)}
          />
          <SidePanel
            instance={instance}
            definitionId={definitionId!}
            definitionVariables={defQ.data.variables ?? []}
            selectedActivity={selected}
          />
        </aside>
      </div>
    </div>
  );
}

function PanelResizer({
  onResize,
  onReset,
}: {
  onResize: (dx: number) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    setDragging(true);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - startX.current;
    if (dx !== 0) {
      startX.current = e.clientX;
      onResize(dx);
    }
  };
  const onUp = () => setDragging(false);

  useEffect(() => {
    if (!dragging) return;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side panel"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={onReset}
      className="group/handle absolute -left-1 top-0 z-20 flex h-full w-2 cursor-ew-resize items-center justify-center"
    >
      <div
        className={[
          "h-12 w-0.5 rounded-full transition-colors duration-100",
          dragging
            ? "bg-sky-500"
            : "bg-border group-hover/handle:bg-sky-500/70",
        ].join(" ")}
      />
    </div>
  );
}

function SubStatusBadge({ subStatus }: { subStatus: string }) {
  if (subStatus === "Executing") {
    return (
      <Badge className="border-sky-600 bg-sky-500 text-white">Executing</Badge>
    );
  }
  if (subStatus === "Suspended") {
    return (
      <Badge className="border-amber-600 bg-amber-500 text-white">
        Suspended
      </Badge>
    );
  }
  if (subStatus === "Faulted") {
    return (
      <Badge className="border-rose-600 bg-rose-500 text-white">Faulted</Badge>
    );
  }
  return <Badge variant="secondary">{subStatus}</Badge>;
}

function walkActivities(
  root: ActivityJson,
  out: Map<string, ActivityJson>,
): void {
  out.set(root.id, root);
  const children = root.activities;
  if (Array.isArray(children)) {
    for (const child of children) walkActivities(child, out);
  }
}

function displayNameFor(activity: ActivityJson | undefined): string | undefined {
  if (!activity) return undefined;
  const meta = activity.metadata as
    | { displayText?: string; description?: string }
    | undefined;
  return (
    meta?.displayText?.trim() ||
    (activity.name as string | undefined) ||
    activity.id
  );
}
