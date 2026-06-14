"use client";

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { useVariableTypes } from "@/lib/api/elsa";

/**
 * `type-picker` UIHint — picks a .NET type from the backend's variable-types
 * catalog. Mirrors the Blazor TypePicker, grouping by category. The picked
 * type name (e.g. `System.String`) is stored as the input's literal value.
 */
export function TypePickerHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const types = useVariableTypes();
  const current = typeof value.expression?.value === "string" ? value.expression.value : "";

  const groups = useMemo(() => {
    const byCategory = new Map<string, { typeName: string; displayName: string }[]>();
    for (const t of types.data ?? []) {
      const cat = t.category || "Other";
      const list = byCategory.get(cat) ?? [];
      list.push({ typeName: t.typeName, displayName: t.displayName });
      byCategory.set(cat, list);
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [types.data]);

  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const t of types.data ?? []) map[t.typeName] = t.displayName;
    return map;
  }, [types.data]);

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
              <SelectValue placeholder="Choose a type…" />
            </SelectTrigger>
            <SelectContent>
              {groups.length === 0 ? (
                <div className="text-muted-foreground p-2 text-xs">
                  {types.isPending ? "Loading types…" : "No types available."}
                </div>
              ) : (
                groups.map(([category, items]) => (
                  <SelectGroup key={category}>
                    <SelectLabel>{category}</SelectLabel>
                    {items
                      .slice()
                      .sort((a, b) => a.displayName.localeCompare(b.displayName))
                      .map((t) => (
                        <SelectItem key={t.typeName} value={t.typeName}>
                          {t.displayName}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                ))
              )}
            </SelectContent>
          </Select>
        )}
      />
    </InputRow>
  );
}
