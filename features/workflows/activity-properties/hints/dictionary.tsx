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

type Pair = { key: string; value: string };

/** Key-value dictionary, stored as a JSON object literal. */
export function DictionaryHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const pairs = readPairs(value.expression?.value);

  const commit = (next: Pair[]) => {
    const obj: Record<string, string> = {};
    for (const p of next) if (p.key) obj[p.key] = p.value;
    ctx.setRaw(withLiteralValue(value, JSON.stringify(obj)));
  };

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
            {pairs.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                <Input
                  placeholder="key"
                  value={p.key}
                  readOnly={ctx.readOnly}
                  onChange={(e) => {
                    const next = pairs.slice();
                    next[i] = { ...next[i], key: e.target.value };
                    commit(next);
                  }}
                />
                <Input
                  placeholder="value"
                  value={p.value}
                  readOnly={ctx.readOnly}
                  onChange={(e) => {
                    const next = pairs.slice();
                    next[i] = { ...next[i], value: e.target.value };
                    commit(next);
                  }}
                />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove"
                  disabled={ctx.readOnly}
                  onClick={() => commit(pairs.filter((_, idx) => idx !== i))}
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
              onClick={() => commit([...pairs, { key: "", value: "" }])}
            >
              <Plus className="size-3.5" /> Add entry
            </Button>
          </div>
        )}
      />
    </InputRow>
  );
}

function readPairs(raw: unknown): Pair[] {
  let obj: Record<string, unknown> | null = null;
  if (raw && typeof raw === "object") obj = raw as Record<string, unknown>;
  else if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === "object" && !Array.isArray(p)) obj = p as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  if (!obj) return [];
  return Object.entries(obj).map(([key, v]) => ({ key, value: typeof v === "string" ? v : String(v ?? "") }));
}
