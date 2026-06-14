"use client";

import { AlertTriangle, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateVariableDialog } from "@/features/workflows/create-variable-dialog";
import { useEditorStore } from "@/features/workflows/editor-store";
import { readVariableRef, writeVariableRef } from "@/features/workflows/variable-reference";
import type { VariableDefinition, WorkflowDefinition } from "@/lib/api/types";

type Props = {
  rawValue: unknown;
  readOnly: boolean;
  onChange: (next: string) => void;
};

/**
 * Editor for the Variable expression syntax — used both by the syntax
 * dispatcher (when the user flips a wrapped input to `Variable`) and by
 * the standalone `variable-picker` UIHint. Shows a dropdown of existing
 * variables plus a `+ New` button that opens `CreateVariableDialog` and
 * auto-selects the freshly created one.
 *
 * Stores the binding as a JSON-stringified `{ id, name }` payload — the
 * same format the Blazor studio uses — so the wire is stable even when
 * the referenced variable is later renamed.
 */
export function VariableSyntaxEditor({ rawValue, readOnly, onChange }: Props) {
  const variables = useEditorStore((s) => s.definition?.variables ?? []);
  const setDefinition = useEditorStore<
    (updater: (prev: WorkflowDefinition) => WorkflowDefinition) => void
  >((s) => s.setDefinition);
  void setDefinition; // used indirectly through the dialog

  const ref = readVariableRef(rawValue);
  const matched = ref ? variables.find((v) => v.id === ref.id) : null;
  const missing = !!ref && !matched;

  const [showCreate, setShowCreate] = useState(false);

  const select = (id: string) => {
    const variable = variables.find((v) => v.id === id);
    if (!variable) return;
    // Serialize the FULL variable so the server's VariableExpressionHandler
    // can rehydrate it as a Variable instance (needs typeName / value / etc.).
    onChange(writeVariableRef(variable));
  };

  const onCreated = (created: VariableDefinition) => {
    // The dialog has already pushed it onto definition.variables; bind to it.
    onChange(writeVariableRef(created));
  };

  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const v of variables) map[v.id] = v.name;
    return map;
  }, [variables]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1.5">
        <div className="min-w-0 flex-1">
          <Select
            items={items}
            value={matched ? matched.id : ""}
            onValueChange={(v) => v && select(v)}
            disabled={readOnly}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="Choose a variable…" />
            </SelectTrigger>
            <SelectContent>
              {variables.length === 0 ? (
                <div className="text-muted-foreground p-2 text-xs">
                  No workflow variables yet — create one to get started.
                </div>
              ) : (
                variables.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{" "}
                    <span className="text-muted-foreground font-mono text-2xs">
                      {shortTypeName(v.typeName)}
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowCreate(true)}
          disabled={readOnly}
          title="Create a new variable"
        >
          <Plus className="size-3.5" /> New
        </Button>
      </div>
      {missing ? (
        <p className="text-amber-600 inline-flex items-center gap-1 text-xs">
          <AlertTriangle className="size-3" />
          Bound variable {ref?.name ? `“${ref.name}”` : ref?.id} is missing from this workflow.
        </p>
      ) : null}

      <CreateVariableDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={onCreated}
      />
    </div>
  );
}

function shortTypeName(name: string): string {
  const noGenerics = name.split("`")[0];
  const segs = noGenerics.split(".");
  return segs[segs.length - 1] ?? name;
}
