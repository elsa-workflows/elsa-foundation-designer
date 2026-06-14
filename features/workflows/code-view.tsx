"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { MonacoCodeEditor } from "@/features/workflows/activity-properties/monaco-editor";
import { useEditorStore } from "@/features/workflows/editor-store";
import type { WorkflowDefinition } from "@/lib/api/types";

/**
 * Read/edit the workflow definition as JSON. The "Auto-apply" toggle parses
 * on every keystroke and pushes back into the store; with it off, users hit
 * Apply explicitly. JSON syntax highlighting + inline diagnostics via Monaco.
 */
export function CodeView() {
  const definition = useEditorStore((s) => s.definition);
  const setDefinition = useEditorStore((s) => s.setDefinition);

  const initialText = useMemo(
    () => (definition ? JSON.stringify(definitionToWire(definition), null, 2) : ""),
    [definition?.id, definition?.version],
  );

  const [text, setText] = useState(initialText);
  const [autoApply, setAutoApply] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [lastApplied, setLastApplied] = useState(initialText);

  // When the definition switches (e.g. after save), reset the editor buffer.
  useEffect(() => {
    setText(initialText);
    setLastApplied(initialText);
    setParseError(null);
  }, [initialText]);

  if (!definition) return null;

  const apply = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as Partial<WorkflowDefinition>;
      setParseError(null);
      setDefinition((prev) => ({
        ...prev,
        name: parsed.name ?? prev.name,
        description: parsed.description ?? prev.description ?? null,
        variables: parsed.variables ?? prev.variables,
        inputs: parsed.inputs ?? prev.inputs,
        outputs: parsed.outputs ?? prev.outputs,
        outcomes: parsed.outcomes ?? prev.outcomes,
        customProperties: parsed.customProperties ?? prev.customProperties,
        options: parsed.options ?? prev.options,
        root: parsed.root ?? prev.root,
      }));
      setLastApplied(raw);
      return true;
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Invalid JSON");
      return false;
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Checkbox
            id="auto-apply"
            checked={autoApply}
            onCheckedChange={(c) => setAutoApply(c)}
          />
          <Label htmlFor="auto-apply" className="text-xs">
            Auto-apply
          </Label>
        </div>
        {!autoApply ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (apply(text)) toast.success("Applied to graph.");
            }}
            disabled={text === lastApplied}
          >
            Apply
          </Button>
        ) : null}
        {parseError ? (
          <span className="text-destructive text-xs">{parseError}</span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
        <MonacoCodeEditor
          value={text}
          language="json"
          readOnly={!!definition.isReadonly}
          height="100%"
          onChange={(v) => {
            setText(v);
            if (autoApply) apply(v);
          }}
        />
      </div>
    </div>
  );
}

/**
 * Strip server-controlled fields (`id`, `version`, ...) when serializing for
 * the editor — the user shouldn't be editing those, and including them is
 * noise.
 */
function definitionToWire(def: WorkflowDefinition) {
  const {
    name,
    description,
    variables,
    inputs,
    outputs,
    outcomes,
    customProperties,
    options,
    root,
  } = def;
  return {
    name,
    description,
    variables,
    inputs,
    outputs,
    outcomes,
    customProperties,
    options,
    root,
  };
}
