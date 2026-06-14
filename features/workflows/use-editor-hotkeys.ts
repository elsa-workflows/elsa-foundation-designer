"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useEditorStore } from "@/features/workflows/editor-store";
import { recomputeNodeIds } from "@/features/workflows/node-id";
import { useSaveWorkflowDefinition } from "@/lib/api/elsa";
import { describeApiError } from "@/lib/api/errors";

/**
 * Global editor hotkeys:
 *  - Ctrl/Cmd + S          → save
 *  - Ctrl/Cmd + Shift + S  → save & publish
 *  - Ctrl/Cmd + Z          → undo
 *  - Ctrl/Cmd + Shift + Z  → redo
 *  - Ctrl/Cmd + Y          → redo (Windows convention)
 *
 * Copy / Paste / Duplicate / Delete are scoped to the canvas and live in
 * `definition-graph.tsx` (they need access to local node selection).
 */
export function useEditorHotkeys() {
  const save = useSaveWorkflowDefinition();

  useEffect(() => {
    const isEditableTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };

    const onKey = async (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const key = e.key.toLowerCase();

      // Save (Ctrl/Cmd+S) — always wins, even from inside inputs.
      if (key === "s") {
        e.preventDefault();
        const def = useEditorStore.getState().definition;
        if (!def || def.isReadonly) return;
        const publishNow = e.shiftKey;
        try {
          const res = await save.mutateAsync({
            publish: publishNow ? true : undefined,
            model: {
              id: def.id,
              definitionId: def.definitionId,
              tenantId: def.tenantId ?? null,
              name: def.name,
              description: def.description ?? null,
              toolVersion: def.toolVersion ?? null,
              variables: def.variables,
              inputs: def.inputs,
              outputs: def.outputs,
              outcomes: def.outcomes,
              customProperties: def.customProperties,
              options: def.options,
              root: recomputeNodeIds(def.root, def.name ?? "Workflow1"),
              labelIds: def.labelIds,
            },
          });
          useEditorStore.getState().markClean(res.workflowDefinition);
          toast.success(publishNow ? "Saved and published." : "Saved.");
        } catch (err) {
          toast.error(`Save failed: ${await describeApiError(err)}`);
        }
        return;
      }

      // Undo / Redo — skip when the user is typing into an editable field
      // (browser-native undo wins there for text input).
      if (isEditableTarget(e.target)) return;

      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undo();
        return;
      }
      if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        useEditorStore.getState().redo();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);
}
