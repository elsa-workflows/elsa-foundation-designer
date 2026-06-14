"use client";

import { Label } from "@/components/ui/label";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

export function RadioListHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const items = readItems(ctx.descriptor.uiSpecifications);
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
          <div className="flex flex-col gap-1.5">
            {items.length === 0 ? (
              <p className="text-muted-foreground text-xs">No options.</p>
            ) : (
              items.map((o) => (
                <Label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 text-xs font-normal"
                >
                  <input
                    type="radio"
                    name={`in-${ctx.descriptor.name}`}
                    value={o.value}
                    checked={current === o.value}
                    disabled={ctx.readOnly}
                    onChange={() => ctx.setRaw(withLiteralValue(value, o.value))}
                    className="accent-primary size-3.5"
                  />
                  {o.label}
                </Label>
              ))
            )}
          </div>
        )}
      />
    </InputRow>
  );
}

function readItems(specs: Record<string, unknown> | null | undefined): { value: string; label: string }[] {
  if (!specs) return [];
  const list = (specs.Items ?? specs.items) as unknown;
  if (!Array.isArray(list)) return [];
  return list
    .map((it) => {
      if (typeof it === "string") return { value: it, label: it };
      if (it && typeof it === "object") {
        const o = it as Record<string, unknown>;
        const value = (o.value ?? o.Value ?? o.text ?? o.Text) as string | undefined;
        const label = (o.text ?? o.Text ?? o.label ?? o.Label ?? value) as string | undefined;
        if (value !== undefined && label !== undefined) return { value, label };
      }
      return null;
    })
    .filter((x): x is { value: string; label: string } => x !== null);
}
