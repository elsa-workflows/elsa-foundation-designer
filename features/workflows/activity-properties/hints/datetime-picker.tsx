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

/**
 * Pragmatic native datetime-local input. The Blazor studio uses MudBlazor's
 * separate date + time pickers; one HTML5 input is shorter and produces an
 * ISO-style string compatible with the .NET DateTime parser.
 */
export function DateTimePickerHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
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
          <Input
            id={`in-${ctx.descriptor.name}`}
            type="datetime-local"
            value={asLocalInput(current)}
            readOnly={ctx.readOnly}
            onChange={(e) =>
              ctx.setRaw(
                withLiteralValue(
                  value,
                  e.target.value ? new Date(e.target.value).toISOString() : "",
                ),
              )
            }
          />
        )}
      />
    </InputRow>
  );
}

function asLocalInput(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
