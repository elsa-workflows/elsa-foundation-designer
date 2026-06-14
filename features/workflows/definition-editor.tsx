"use client";

import { AlertCircle, Leaf, Loader2 } from "lucide-react";
import { useEffect } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityPalette } from "@/features/workflows/activity-palette";
import { ActivityPropertiesPanel } from "@/features/workflows/activity-properties/panel";
import { CanvasBreadcrumb } from "@/features/workflows/canvas-breadcrumb";
import { CanvasErrorBoundary } from "@/features/workflows/canvas-error-boundary";
import { CodeView } from "@/features/workflows/code-view";
import { DefinitionGraph } from "@/features/workflows/definition-graph";
import { useEditorStore } from "@/features/workflows/editor-store";
import { EditorToolbar } from "@/features/workflows/editor-toolbar";
import { InspectorResizer } from "@/features/workflows/inspector-resizer";
import { recomputeNodeIds } from "@/features/workflows/node-id";
import { useEditorHotkeys } from "@/features/workflows/use-editor-hotkeys";
import { useUnsavedChangesGuard } from "@/features/workflows/use-unsaved-changes-guard";
import { ValidationPanel } from "@/features/workflows/validation-panel";
import { WorkflowPropertiesPanel } from "@/features/workflows/workflow-properties/panel";
import { useSaveWorkflowDefinition, useWorkflowDefinition } from "@/lib/api/elsa";

export function DefinitionEditor({ definitionId }: { definitionId: string }) {
  const q = useWorkflowDefinition(definitionId, "Latest");
  const hydrate = useEditorStore((s) => s.hydrate);
  const reset = useEditorStore((s) => s.reset);

  // Hydrate the store when the fetched definition changes.
  useEffect(() => {
    if (q.data) hydrate(q.data);
    return () => reset();
    // We intentionally don't depend on hydrate/reset (stable Zustand refs).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  useEditorHotkeys();
  useUnsavedChangesGuard();
  useAutoSave();

  if (q.isPending) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" /> Loading workflow…
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
              <p className="text-sm font-medium">Couldn&apos;t load this workflow.</p>
              <p className="text-muted-foreground text-xs">
                Either the definition ID is unknown or the Elsa server returned an error.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    // h-[calc(100svh-3.5rem)] caps the editor at viewport-minus-AppHeader
    // (the header is h-14 = 3.5rem). Without this every inner flex column
    // grows to fit its content and the whole page scrolls — defeating the
    // palette / properties / canvas internal scroll affordances.
    <main className="bg-muted/30 flex h-[calc(100svh-3.5rem)] flex-col overflow-hidden">
      <EditorToolbar />
      {q.data.isReadonly ? <ReadOnlyBanner /> : null}

      <EditorBody />
    </main>
  );
}

function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-900 dark:text-amber-100">
      <Leaf className="size-3.5 shrink-0" />
      You are viewing a read-only workflow. Edits are disabled.
    </div>
  );
}

function EditorBody() {
  const paletteCollapsed = useEditorStore((s) => s.paletteCollapsed);
  const inspectorWidth = useEditorStore((s) => s.inspectorWidth);
  const inspectorFocus = useEditorStore((s) => s.inspectorFocus);
  const selectedId = useEditorStore((s) => s.selectedActivityId);
  const tab = useEditorStore((s) => s.tab);
  const setTab = useEditorStore((s) => s.setTab);

  // Inspector width when focus-mode is on — pin to ~55% of the editor area so
  // long expressions / code / JSON get real estate. The store width still
  // applies when focus is off.
  const inspectorPx = inspectorFocus
    ? "min(60vw, 900px)"
    : `${inspectorWidth}px`;

  // Hide the inspector entirely when nothing's selected so the canvas owns
  // the screen. The user-set width is preserved in the store.
  const showInspector = !!selectedId;

  return (
    <div
      className="grid flex-1 overflow-hidden"
      style={{
        gridTemplateColumns: showInspector
          ? `${paletteCollapsed ? "3rem" : "17rem"} 1fr ${inspectorPx}`
          : `${paletteCollapsed ? "3rem" : "17rem"} 1fr 0px`,
      }}
    >
      <aside className="bg-background flex flex-col overflow-hidden border-r">
        <ActivityPalette />
      </aside>

      <section className="flex min-w-0 flex-col overflow-hidden">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex h-full min-h-0 flex-1 flex-col"
        >
          <div className="bg-background flex items-center justify-between border-b px-3 py-1.5">
            <TabsList variant="line">
              <TabsTrigger value="designer">Designer</TabsTrigger>
              <TabsTrigger value="code">Code</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="designer" className="relative flex min-h-0 flex-1 flex-col">
            <CanvasBreadcrumb />
            <div className="relative min-h-0 flex-1">
              <CanvasErrorBoundary>
                <DefinitionGraph editable />
              </CanvasErrorBoundary>
            </div>
          </TabsContent>
          <TabsContent value="code" className="bg-background min-h-0 flex-1 overflow-auto">
            <CodeView />
          </TabsContent>
          <TabsContent value="properties" className="bg-background min-h-0 flex-1 overflow-auto">
            <WorkflowPropertiesPanel />
          </TabsContent>
        </Tabs>
        <ValidationPanel />
      </section>

      <aside
        className={[
          "bg-background relative flex flex-col overflow-hidden border-l transition-shadow",
          inspectorFocus ? "shadow-[-12px_0_28px_-12px_rgba(0,0,0,0.18)]" : "",
          showInspector ? "" : "hidden",
        ].join(" ")}
      >
        <InspectorResizer />
        <ActivityPropertiesPanel />
      </aside>
    </div>
  );
}

/**
 * Debounced auto-save when the toolbar toggle is on. Only saves drafts — we
 * never auto-publish.
 */
function useAutoSave() {
  const autoSave = useEditorStore((s) => s.autoSave);
  const isDirty = useEditorStore((s) => s.isDirty);
  const definition = useEditorStore((s) => s.definition);
  const markClean = useEditorStore((s) => s.markClean);
  const save = useSaveWorkflowDefinition();

  useEffect(() => {
    if (!autoSave || !isDirty || !definition) return;
    const t = setTimeout(async () => {
      try {
        const res = await save.mutateAsync({
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
        markClean(res.workflowDefinition);
      } catch {
        // Toast suppressed; the user will see Save flicker red on the toolbar.
      }
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSave, isDirty, definition]);
}
