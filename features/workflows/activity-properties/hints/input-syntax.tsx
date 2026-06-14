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
import { useEditorStore } from "@/features/workflows/editor-store";
import { readInputRef, writeInputRef } from "@/features/workflows/variable-reference";
import { EditInputDialog } from "@/features/workflows/workflow-properties/edit-input-dialog";
import type { InputDefinition } from "@/lib/api/types";

type Props = {
  rawValue: unknown;
  readOnly: boolean;
  onChange: (next: string) => void;
};

/**
 * Editor for the Input expression syntax — bind to a workflow input.
 * Stores as JSON-stringified `{ name, displayName, type }` to mirror the
 * Blazor studio's wire shape; the `name` is what actually identifies the
 * input at runtime, the rest carries forward in case the input gets
 * renamed.
 *
 * The `+ New` button opens `EditInputDialog` to create a workflow input
 * inline (without leaving the activity-properties dialog) and auto-binds
 * the new input on submit. Available regardless of whether any inputs
 * already exist — mirrors the variable picker's affordance.
 */
export function InputSyntaxEditor({ rawValue, readOnly, onChange }: Props) {
  const inputs = useEditorStore((s) => s.definition?.inputs ?? []);
  const ref = readInputRef(rawValue);
  const matched = ref ? inputs.find((i) => i.name === ref.name) : null;
  const missing = !!ref && !matched;

  const [showCreate, setShowCreate] = useState(false);

  const select = (name: string) => {
    const input = inputs.find((i) => i.name === name);
    if (!input) return;
    onChange(
      writeInputRef({
        name: input.name,
        displayName: input.displayName,
        type: input.type,
      }),
    );
  };

  const onCreated = (created: InputDefinition) => {
    onChange(
      writeInputRef({
        name: created.name,
        displayName: created.displayName,
        type: created.type,
      }),
    );
  };

  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const i of inputs) map[i.name] = i.displayName || i.name;
    return map;
  }, [inputs]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-1.5">
        <div className="min-w-0 flex-1">
          <Select
            items={items}
            value={matched ? matched.name : ""}
            onValueChange={(v) => v && select(v)}
            disabled={readOnly}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="Choose a workflow input…" />
            </SelectTrigger>
            <SelectContent>
              {inputs.length === 0 ? (
                <div className="text-muted-foreground p-2 text-xs">
                  No workflow inputs yet — create one to get started.
                </div>
              ) : (
                inputs.map((i) => (
                  <SelectItem key={i.name} value={i.name}>
                    {i.displayName || i.name}{" "}
                    <span className="text-muted-foreground font-mono text-2xs">
                      {shortTypeName(i.type)}
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
          title="Create a new workflow input"
        >
          <Plus className="size-3.5" /> New
        </Button>
      </div>
      {missing ? (
        <p className="text-amber-600 inline-flex items-center gap-1 text-xs">
          <AlertTriangle className="size-3" />
          Bound input {ref?.displayName ? `“${ref.displayName}”` : ref?.name} is missing.
        </p>
      ) : null}

      <EditInputDialog
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
