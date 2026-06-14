"use client";

import { Input } from "@/components/ui/input";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

/** Fallback when no specific handler matches the UI hint. Generic text input. */
export function FallbackHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const current =
    value.expression?.value === undefined || value.expression?.value === null
      ? ""
      : typeof value.expression.value === "string"
        ? value.expression.value
        : JSON.stringify(value.expression.value);

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
          <Input
            id={`in-${ctx.descriptor.name}`}
            value={current}
            readOnly={ctx.readOnly}
            onChange={(e) => ctx.setRaw(withLiteralValue(value, e.target.value))}
          />
        )}
      />
    </InputRow>
  );
}
