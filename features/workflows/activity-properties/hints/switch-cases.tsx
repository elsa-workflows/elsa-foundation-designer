"use client";

import { Plus, Trash2 } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";

type FlowCase = {
  label: string;
  condition: { type?: string; value?: string } | string | null | undefined;
};

type SwitchCase = FlowCase & {
  /** Only present on Elsa.Switch — Elsa.FlowSwitch carries no embedded activity. */
  activity?: unknown;
};

/**
 * Shared editor for `Elsa.FlowSwitch.Cases` and `Elsa.Switch.Cases`. The
 * Blazor inventory exposes them as separate UIHints (`flow-switch-editor`
 * and `switch-editor`) but the shape is the same: each case has a label and
 * a condition expression. The Switch variant additionally carries a nested
 * `activity` field, which we leave intact (it's edited via the canvas
 * embedded slot rather than this hint).
 *
 * Conditions are JavaScript expressions by default.
 */
export function FlowSwitchCasesHint({ ctx }: { ctx: HintContext }) {
  return <CasesEditor ctx={ctx} withActivity={false} />;
}

export function SwitchCasesHint({ ctx }: { ctx: HintContext }) {
  return <CasesEditor ctx={ctx} withActivity={true} />;
}

function CasesEditor({ ctx, withActivity }: { ctx: HintContext; withActivity: boolean }) {
  const baseId = useId();
  const cases = readCases(ctx.activity as Record<string, unknown>);
  const setCases = (next: SwitchCase[]) => ctx.setRaw(next);

  const update = (i: number, patch: Partial<SwitchCase>) => {
    const next = cases.slice();
    next[i] = { ...next[i], ...patch };
    setCases(next);
  };

  const remove = (i: number) => setCases(cases.filter((_, idx) => idx !== i));

  const add = () => {
    const next: SwitchCase = {
      label: nextDefaultLabel(cases),
      condition: { type: "JavaScript", value: "" },
    };
    if (withActivity) next.activity = null;
    setCases([...cases, next]);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium">
        {ctx.descriptor.displayName ?? "Cases"}
      </Label>
      {ctx.descriptor.description ? (
        <p className="text-muted-foreground text-xs">{ctx.descriptor.description}</p>
      ) : null}

      <div className="flex flex-col gap-2">
        {cases.length === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-2 py-3 text-center text-xs italic">
            No cases yet — add one below.
          </p>
        ) : null}
        {cases.map((c, i) => (
          <div
            key={`${baseId}-${i}`}
            className="bg-muted/30 grid gap-1.5 rounded-md border p-2"
          >
            <div className="flex items-center gap-1.5">
              <Input
                value={c.label ?? ""}
                placeholder="Case label"
                readOnly={ctx.readOnly}
                onChange={(e) => update(i, { label: e.target.value })}
                className="flex-1"
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Remove case"
                disabled={ctx.readOnly}
                onClick={() => remove(i)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <Textarea
              value={readConditionValue(c.condition)}
              placeholder="Condition (JavaScript expression)"
              rows={2}
              readOnly={ctx.readOnly}
              onChange={(e) =>
                update(i, { condition: { type: readConditionType(c.condition), value: e.target.value } })
              }
              className="font-mono text-xs"
            />
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          disabled={ctx.readOnly}
          onClick={add}
        >
          <Plus className="size-3.5" /> Add case
        </Button>
      </div>
    </div>
  );
}

function readCases(activity: Record<string, unknown>): SwitchCase[] {
  const raw = activity.cases;
  if (!Array.isArray(raw)) return [];
  return raw.map((c) => {
    if (c && typeof c === "object") {
      const o = c as Record<string, unknown>;
      return {
        label: typeof o.label === "string" ? o.label : "",
        condition: (o.condition ?? null) as SwitchCase["condition"],
        activity: o.activity,
      };
    }
    return { label: "", condition: null };
  });
}

function readConditionValue(condition: SwitchCase["condition"]): string {
  if (condition == null) return "";
  if (typeof condition === "string") return condition;
  if (typeof condition === "object" && typeof condition.value === "string") return condition.value;
  return "";
}

function readConditionType(condition: SwitchCase["condition"]): string {
  if (condition && typeof condition === "object" && typeof condition.type === "string") {
    return condition.type;
  }
  return "JavaScript";
}

function nextDefaultLabel(existing: SwitchCase[]): string {
  const used = new Set(existing.map((c) => c.label));
  let n = existing.length + 1;
  while (used.has(`Case ${n}`)) n += 1;
  return `Case ${n}`;
}
