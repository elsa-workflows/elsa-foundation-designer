"use client";

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { useEditorStore } from "@/features/workflows/editor-store";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import { InputSyntaxEditor } from "@/features/workflows/activity-properties/hints/input-syntax";
import { VariableSyntaxEditor } from "@/features/workflows/activity-properties/hints/variable-syntax";
import {
  readNakedInput,
  readWrappedInput,
  withLiteralValue,
  withSyntax,
  withSyntaxAndValue,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";
import { useWorkflowDefinitions } from "@/lib/api/elsa";

/**
 * `variable-picker` UIHint — same wire format as the `Variable` syntax
 * editor, sharing `VariableSyntaxEditor` so both code paths produce
 * `{ id, name }` JSON and both expose the `+ New` button.
 */
export function VariablePickerHint({ ctx }: { ctx: HintContext }) {
  // Set Variable's `Variable` property (and any other `Variable?`-typed
  // activity field) is declared as a NAKED input — the descriptor has
  // `isWrapped: false`. In that case the activity stores the variable
  // object directly at `activity.<camelize(name)>`, without the
  // `{ typeName, expression }` envelope used by wrapped inputs.
  //
  // For wrapped variable inputs (e.g. an `Input<Variable>`), the value
  // lives inside `expression.value` with `expression.type = "Variable"` —
  // matches Blazor's `VariablePicker.razor.cs` branch.
  const isWrapped = ctx.descriptor.isWrapped !== false;

  if (!isWrapped) {
    const raw = readNakedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
    return (
      <VariableSyntaxEditor
        rawValue={raw}
        readOnly={ctx.readOnly}
        onChange={(next) => {
          // The naked input stores the parsed Variable object — keep the
          // wire shape as an object (not a JSON string) so the server's
          // model binder can deserialise it directly into a `Variable`.
          try {
            ctx.setRaw(JSON.parse(next));
          } catch {
            // Defensive: if for any reason `next` isn't valid JSON, fall
            // back to writing the raw string — the server will surface a
            // schema error rather than silently dropping the binding.
            ctx.setRaw(next);
          }
        }}
      />
    );
  }

  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <VariableSyntaxEditor
        rawValue={value.expression?.value}
        readOnly={ctx.readOnly}
        // Force `expression.type = "Variable"` regardless of what the slot
        // held before. Without this, an empty slot defaults to "Literal" and
        // the server treats the JSON as a literal string instead of a
        // variable reference, so the binding never resolves.
        onChange={(next) => ctx.setRaw(withSyntaxAndValue(value, "Variable", next))}
      />
    </InputRow>
  );
}

/** Pick an outcome name from the activity's declared outcomes. */
export function OutcomePickerHint({ ctx }: { ctx: HintContext }) {
  const descriptors = useEditorStore.getState();
  void descriptors; // placeholder reference — we read outcomes from the descriptor's ports
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const outcomes = (ctx.descriptor.uiSpecifications?.Outcomes ?? ctx.descriptor.uiSpecifications?.outcomes) as
    | string[]
    | undefined;
  const fallback = ctx.activity.outcomes as string[] | undefined;
  const items: string[] = outcomes ?? fallback ?? ["Done"];
  const current = typeof value.expression?.value === "string" ? value.expression.value : "";

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <SyntaxEditor
        ctx={ctx}
        renderLiteral={() => (
          <Select
            value={current}
            onValueChange={(v) => v && ctx.setRaw(withLiteralValue(value, v))}
            disabled={ctx.readOnly}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="Choose an outcome…" />
            </SelectTrigger>
            <SelectContent>
              {items.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </InputRow>
  );
}

/** Pick a workflow definition (by definitionId). */
export function WorkflowDefinitionPickerHint({ ctx }: { ctx: HintContext }) {
  const q = useWorkflowDefinitions({ pageSize: 200, versionOptions: "Published" });
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const current = typeof value.expression?.value === "string" ? value.expression.value : "";
  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const d of q.data?.items ?? []) {
      map[d.definitionId] = d.name || d.definitionId.slice(0, 8);
    }
    return map;
  }, [q.data]);

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <SyntaxEditor
        ctx={ctx}
        renderLiteral={() => (
          <Select
            items={items}
            value={current}
            onValueChange={(v) => v && ctx.setRaw(withLiteralValue(value, v))}
            disabled={ctx.readOnly || q.isPending}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder={q.isPending ? "Loading…" : "Choose a workflow…"} />
            </SelectTrigger>
            <SelectContent>
              {(q.data?.items ?? []).map((d) => (
                <SelectItem key={d.definitionId} value={d.definitionId}>
                  {d.name || d.definitionId.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </InputRow>
  );
}

/**
 * `input-picker` UIHint — same wire shape as the `Input` syntax editor.
 * Reuses `InputSyntaxEditor` so both paths agree on the JSON payload.
 */
export function InputPickerHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <InputSyntaxEditor
        rawValue={value.expression?.value}
        readOnly={ctx.readOnly}
        // Same rationale as the variable picker — force `expression.type = "Input"`.
        onChange={(next) => ctx.setRaw(withSyntaxAndValue(value, "Input", next))}
      />
    </InputRow>
  );
}

/** Pick a workflow output by name. */
export function OutputPickerHint({ ctx }: { ctx: HintContext }) {
  const outputs = useEditorStore((s) => s.definition?.outputs ?? []);
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const current = typeof value.expression?.value === "string" ? value.expression.value : "";
  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const o of outputs) map[o.name] = o.displayName || o.name;
    return map;
  }, [outputs]);

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <SyntaxEditor
        ctx={ctx}
        renderLiteral={() => (
          <Select
            items={items}
            value={current}
            onValueChange={(v) => v && ctx.setRaw(withLiteralValue(value, v))}
            disabled={ctx.readOnly}
          >
            <SelectTrigger size="sm">
              <SelectValue placeholder="Choose a workflow output…" />
            </SelectTrigger>
            <SelectContent>
              {outputs.length === 0 ? (
                <div className="text-muted-foreground p-2 text-xs">
                  No workflow outputs yet.
                </div>
              ) : (
                outputs.map((o) => (
                  <SelectItem key={o.name} value={o.name}>
                    {o.displayName || o.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      />
    </InputRow>
  );
}
