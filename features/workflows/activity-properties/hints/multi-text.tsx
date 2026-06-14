"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

/** Editable list of strings — stored as a JSON array literal. */
export function MultiTextHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const items = readItems(value.expression?.value);

  const update = (next: string[]) => ctx.setRaw(withLiteralValue(value, JSON.stringify(next)));

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
            {items.map((v, i) => (
              <div key={i} className="flex gap-1">
                <Input
                  value={v}
                  readOnly={ctx.readOnly}
                  onChange={(e) => {
                    const next = items.slice();
                    next[i] = e.target.value;
                    update(next);
                  }}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove"
                  disabled={ctx.readOnly}
                  onClick={() => update(items.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="self-start"
              disabled={ctx.readOnly}
              onClick={() => update([...items, ""])}
            >
              <Plus className="size-3.5" /> Add value
            </Button>
          </div>
        )}
      />
    </InputRow>
  );
}

function readItems(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map((x) => String(x));
    } catch {
      // fall through
    }
  }
  return [];
}
