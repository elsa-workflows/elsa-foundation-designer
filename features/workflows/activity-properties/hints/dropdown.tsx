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
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

type Option = { value: string; label: string };

function pick(o: Record<string, unknown> | null | undefined, ...keys: string[]): unknown {
  if (!o) return undefined;
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
}

function readOptions(specs: Record<string, unknown> | null | undefined): Option[] {
  if (!specs) return [];
  // Backend (DropDownOptionsProviderBase) serializes the options at
  // `uiSpecifications.dropdown.selectList.items`. Walk that path first;
  // fall back to flat `Items` for static / legacy shapes.
  const props = pick(specs, "dropdown", "Dropdown", "DropDown") as
    | Record<string, unknown>
    | undefined;
  const selectList = pick(props, "selectList", "SelectList") as
    | Record<string, unknown>
    | undefined;
  const wireItems = pick(selectList, "items", "Items");
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
    .filter((x): x is Option => x !== null);
}

export function DropdownHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const options = readOptions(ctx.descriptor.uiSpecifications ?? null);
  const current = typeof value.expression?.value === "string" ? value.expression.value : "";
  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const o of options) map[o.value] = o.label;
    return map;
  }, [options]);

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
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {options.length === 0 ? (
                <div className="text-muted-foreground p-2 text-xs">No options.</div>
              ) : (
                options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
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
