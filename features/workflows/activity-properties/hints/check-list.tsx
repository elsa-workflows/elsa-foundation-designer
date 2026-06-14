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

/**
 * Multi-select checkboxes. Stores the selection as a JSON array literal —
 * matching the Blazor handler's `UISyntax = WellKnownSyntaxNames.Object`.
 */
export function CheckListHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const items = readItems(ctx.descriptor.uiSpecifications);
  const current = readSelection(value.expression?.value);

  const toggle = (v: string, on: boolean) => {
    const next = on ? Array.from(new Set([...current, v])) : current.filter((x) => x !== v);
    ctx.setRaw(withLiteralValue(value, JSON.stringify(next)));
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
            {items.length === 0 ? (
              <p className="text-muted-foreground text-xs">No options.</p>
            ) : (
              items.map((o) => {
                const on = current.includes(o.value);
                return (
                  <Label
                    key={o.value}
                    className="flex cursor-pointer items-center gap-2 text-xs font-normal"
                  >
                    <Checkbox
                      checked={on}
                      disabled={ctx.readOnly}
                      onCheckedChange={(c) => toggle(o.value, c)}
                    />
                    {o.label}
                  </Label>
                );
              })
            )}
          </div>
        )}
      />
    </InputRow>
  );
}

function pick(o: Record<string, unknown> | null | undefined, ...keys: string[]): unknown {
  if (!o) return undefined;
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
}

function readItems(specs: Record<string, unknown> | null | undefined): { value: string; label: string }[] {
  if (!specs) return [];
  // Backend (CheckListOptionsProviderBase) serializes the options at
  // `uiSpecifications.checklist.checkList.items`. Walk that path first;
  // fall back to flat `Items` for static / legacy shapes.
  const props = pick(specs, "checklist", "Checklist", "CheckList") as
    | Record<string, unknown>
    | undefined;
  const checkList = pick(props, "checkList", "CheckList") as
    | Record<string, unknown>
    | undefined;
  const wireItems = pick(checkList, "items", "Items");
  const list = (wireItems ?? pick(specs, "Items", "items")) as unknown;
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

function readSelection(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    } catch {
      // fall through
    }
  }
  return [];
}
