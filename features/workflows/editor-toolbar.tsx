"use client";

import {
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Copy,
  Download,
  LayoutTemplate,
  Loader2,
  MoreVertical,
  Play,
  Redo2,
  Save,
  Undo2,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  getSequenceOrientation,
  isSequenceRoot,
  isStateMachineRoot,
} from "@/features/workflows/build-graph";
import { CloneDefinitionDialog } from "@/features/workflows/clone-definition-dialog";
import {
  getContainerAt,
  useEditorStore,
} from "@/features/workflows/editor-store";
import { ExportDefinitionDialog } from "@/features/workflows/export-definition-dialog";
import { layoutRootHappyPath } from "@/features/workflows/happy-path-layout";
import { ImportDefinitionDialog } from "@/features/workflows/import-definition-dialog";
import { recomputeNodeIds } from "@/features/workflows/node-id";
import { layoutRootSequence } from "@/features/workflows/sequence-layout";
import { layoutRootStateMachine } from "@/features/workflows/state-machine-layout";
import { RunWorkflowDialog } from "@/features/workflows/run-workflow-dialog";
import { useMemo, useState } from "react";
import { describeApiError, tryExtractValidationErrors } from "@/lib/api/errors";
import {
  useActivityDescriptors,
  useExecuteDefinition,
  usePublishDefinition,
  useRetractDefinition,
  useSaveWorkflowDefinition,
} from "@/lib/api/elsa";
import type { SaveWorkflowDefinitionRequest } from "@/lib/api/types";

/** Header strip with primary actions for editing a workflow. */
export function EditorToolbar() {
  const router = useRouter();
  const definition = useEditorStore((s) => s.definition);
  const isDirty = useEditorStore((s) => s.isDirty);
  const autoSave = useEditorStore((s) => s.autoSave);
  const setAutoSave = useEditorStore((s) => s.setAutoSave);
  const markClean = useEditorStore((s) => s.markClean);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const pushSnapshot = useEditorStore((s) => s.pushSnapshot);
  const setRoot = useEditorStore((s) => s.setRoot);
  const setValidationErrors = useEditorStore((s) => s.setValidationErrors);
  const clearValidationErrors = useEditorStore((s) => s.clearValidationErrors);
  const selectedActivityId = useEditorStore((s) => s.selectedActivityId);
  const containerStack = useEditorStore((s) => s.containerStack);
  const moveSequenceActivity = useEditorStore((s) => s.moveSequenceActivity);

  const save = useSaveWorkflowDefinition();
  const publish = usePublishDefinition();
  const retract = useRetractDefinition();
  const execute = useExecuteDefinition();
  const descriptors = useActivityDescriptors();
  const descriptorList = descriptors.data;
  const descriptorIndex = useMemo(() => {
    const map = new Map<string, NonNullable<typeof descriptorList>[number]>();
    for (const d of descriptorList ?? []) map.set(d.typeName, d);
    return map;
  }, [descriptorList]);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);

  // Position of the selected activity inside the active container's
  // `activities[]` when that container is a Sequence. Drives the
  // Earlier/Later button enablement. Computed unconditionally so the hook
  // order stays stable across the early-return below.
  const sequenceMoveState = useMemo(() => {
    if (!definition || !selectedActivityId) return null;
    const container = getContainerAt(definition.root, containerStack);
    if (!isSequenceRoot(container)) return null;
    const activities = container.activities ?? [];
    const idx = activities.findIndex((a) => a.id === selectedActivityId);
    if (idx < 0) return null;
    return {
      canMoveEarlier: idx > 0,
      canMoveLater: idx < activities.length - 1,
    };
  }, [definition, containerStack, selectedActivityId]);

  if (!definition) return null;

  const readonly = !!definition.isReadonly;

  const buildSaveRequest = (forPublish: boolean): SaveWorkflowDefinitionRequest => ({
    publish: forPublish ? true : undefined,
    model: {
      id: definition.id,
      definitionId: definition.definitionId,
      tenantId: definition.tenantId ?? null,
      name: definition.name,
      description: definition.description ?? null,
      toolVersion: definition.toolVersion ?? null,
      variables: definition.variables,
      inputs: definition.inputs,
      outputs: definition.outputs,
      outcomes: definition.outcomes,
      customProperties: definition.customProperties,
      options: definition.options,
      root: recomputeNodeIds(definition.root, definition.name ?? "Workflow1"),
      labelIds: definition.labelIds,
    },
  });

  const onSave = async (publishNow = false) => {
    try {
      const res = await save.mutateAsync(buildSaveRequest(publishNow));
      markClean(res.workflowDefinition);
      clearValidationErrors();
      toast.success(publishNow ? "Saved and published." : "Saved.");
    } catch (err) {
      const validation = await tryExtractValidationErrors(err);
      if (validation) {
        setValidationErrors(validation);
        toast.error("Validation failed — see panel below the canvas.");
      } else {
        toast.error(`Save failed: ${await describeApiError(err)}`);
      }
    }
  };

  const onPublish = async () => {
    try {
      // Save in-flight edits first so publish snaps to the latest state.
      if (isDirty) {
        await onSave(true);
        return;
      }
      await publish.mutateAsync(definition.definitionId);
      clearValidationErrors();
      toast.success("Published.");
    } catch (err) {
      const validation = await tryExtractValidationErrors(err);
      if (validation) {
        setValidationErrors(validation);
        toast.error("Validation failed — see panel below the canvas.");
      } else {
        toast.error(`Publish failed: ${await describeApiError(err)}`);
      }
    }
  };

  const onRetract = async () => {
    try {
      await retract.mutateAsync(definition.definitionId);
      toast.success("Unpublished.");
    } catch (err) {
      toast.error(`Unpublish failed: ${await describeApiError(err)}`);
    }
  };

  const onRun = async () => {
    if (isDirty) {
      toast.info("Save before running so the latest version executes.");
      return;
    }
    // If the workflow declares inputs, prompt the user. Otherwise run directly.
    if ((definition.inputs ?? []).length > 0) {
      setShowRunDialog(true);
      return;
    }
    try {
      const res = await execute.mutateAsync({ definitionId: definition.definitionId });
      if (res.cannotStart) {
        toast.error("Workflow can't start (no published version or missing trigger).");
      } else if (res.workflowInstanceId) {
        toast.success("Started.", {
          action: { label: "Instances", onClick: () => router.push("/workflows/instances") },
        });
      } else {
        toast.success("Started.");
      }
    } catch {
      toast.error("Couldn't start the workflow.");
    }
  };

  const saving = save.isPending;

  const onAutoLayout = () => {
    if (readonly || !definition) return;
    pushSnapshot();
    const nextRoot = isStateMachineRoot(definition.root)
      ? layoutRootStateMachine(definition.root)
      : isSequenceRoot(definition.root)
        ? layoutRootSequence(definition.root)
        : layoutRootHappyPath(definition.root, descriptorIndex);
    setRoot(nextRoot);
    toast.success("Auto-laid out.");
  };

  /** Flip the persisted Sequence orientation and re-layout immediately. */
  const isSequence = !!definition && isSequenceRoot(definition.root);
  const sequenceOrientation = definition
    ? getSequenceOrientation(definition.root)
    : "horizontal";
  const onToggleSequenceOrientation = () => {
    if (readonly || !definition || !isSequence) return;
    pushSnapshot();
    const next: "vertical" | "horizontal" =
      sequenceOrientation === "vertical" ? "horizontal" : "vertical";
    const root = definition.root;
    const nextCustom = {
      ...((root.customProperties as Record<string, unknown> | undefined) ?? {}),
      sequenceOrientation: next,
    };
    setRoot(layoutRootSequence({ ...root, customProperties: nextCustom }));
  };


  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back"
          render={<Link href="/workflows/definitions" />}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">
            {definition.name || (
              <span className="text-muted-foreground font-mono">
                {definition.definitionId.slice(0, 8)}
              </span>
            )}
          </h1>
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Badge
              variant={definition.isPublished ? "default" : "outline"}
              className="font-normal"
            >
              {definition.isPublished ? "Published" : "Draft"}
            </Badge>
            <span className="tabular-nums">v{definition.version}</span>
            {isDirty ? <span className="text-amber-600">· unsaved</span> : null}
            {readonly ? <span>· read-only</span> : null}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!readonly ? (
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Undo"
                title="Undo (Ctrl/Cmd + Z)"
                onClick={() => undo()}
                disabled={!canUndo}
              >
                <Undo2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Redo"
                title="Redo (Ctrl/Cmd + Shift + Z)"
                onClick={() => redo()}
                disabled={!canRedo}
              >
                <Redo2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Auto-layout"
                title="Auto-layout"
                onClick={onAutoLayout}
              >
                <LayoutTemplate className="size-4" />
              </Button>
              {isSequence ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={
                    sequenceOrientation === "vertical"
                      ? "Switch to horizontal layout"
                      : "Switch to vertical layout"
                  }
                  title={
                    sequenceOrientation === "vertical"
                      ? "Switch to horizontal layout"
                      : "Switch to vertical layout"
                  }
                  onClick={onToggleSequenceOrientation}
                >
                  <ArrowRightLeft className="size-4" />
                </Button>
              ) : null}
              {sequenceMoveState ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move activity earlier in the sequence"
                    title="Move earlier"
                    disabled={!sequenceMoveState.canMoveEarlier}
                    onClick={() =>
                      selectedActivityId &&
                      moveSequenceActivity(selectedActivityId, "earlier")
                    }
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move activity later in the sequence"
                    title="Move later"
                    disabled={!sequenceMoveState.canMoveLater}
                    onClick={() =>
                      selectedActivityId &&
                      moveSequenceActivity(selectedActivityId, "later")
                    }
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}
          {!readonly ? (
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="autosave"
                checked={autoSave}
                onCheckedChange={(c) => setAutoSave(c)}
              />
              <Label htmlFor="autosave" className="text-xs">
                Auto-save
              </Label>
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExport(true)}
          >
            <Download className="size-3.5" /> Export
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="More workflow actions" />
              }
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setShowSaveAs(true)}
                disabled={readonly}
              >
                <Copy className="size-3.5" /> Save as…
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setShowImport(true)}
                disabled={readonly}
              >
                <Upload className="size-3.5" /> Import workflow…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {!readonly ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void onSave(false)}
                disabled={saving || !isDirty}
                title="Ctrl/Cmd + S"
                className="relative"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                Save
                {isDirty && !saving ? (
                  <span
                    aria-hidden
                    className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
                  />
                ) : null}
              </Button>
              {definition.isPublished ? (
                <Button variant="outline" size="sm" onClick={() => void onRetract()}>
                  <XCircle className="size-3.5" /> Unpublish
                </Button>
              ) : (
                <Button size="sm" onClick={() => void onPublish()}>
                  <CheckCircle2 className="size-3.5" /> Publish
                </Button>
              )}
            </>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => void onRun()}>
            <Play className="size-3.5" /> Run
          </Button>
        </div>
      </div>

      {showExport ? (
        <ExportDefinitionDialog
          open
          onOpenChange={(o) => !o && setShowExport(false)}
          mode="single"
          definitionId={definition.definitionId}
          defaultFilename={`${definition.name || "workflow"}.json`}
        />
      ) : null}

      <ImportDefinitionDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={() => router.refresh()}
      />

      <CloneDefinitionDialog
        open={showSaveAs}
        onOpenChange={setShowSaveAs}
        source={{
          definitionId: definition.definitionId,
          name: definition.name,
          description: definition.description ?? null,
        }}
        onCloned={(def) => router.push(`/workflows/definitions/${def.definitionId}/edit`)}
      />

      <RunWorkflowDialog
        open={showRunDialog}
        onOpenChange={setShowRunDialog}
        definition={definition}
        onStarted={() =>
          toast.success("Started.", {
            action: { label: "Instances", onClick: () => router.push("/workflows/instances") },
          })
        }
      />
    </>
  );
}
