"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

export function CheckboxHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const checked = parseBoolean(value.expression?.value);

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
          <div className="flex items-center gap-2">
            <Checkbox
              id={`in-${ctx.descriptor.name}`}
              checked={checked}
              disabled={ctx.readOnly}
              onCheckedChange={(c) => ctx.setRaw(withLiteralValue(value, c))}
            />
            <Label htmlFor={`in-${ctx.descriptor.name}`} className="text-xs">
              {checked ? "True" : "False"}
            </Label>
          </div>
        )}
      />
    </InputRow>
  );
}

function parseBoolean(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") return raw.toLowerCase() === "true";
  return false;
}
