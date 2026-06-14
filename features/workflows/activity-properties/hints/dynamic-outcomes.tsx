"use client";

import { Label } from "@/components/ui/label";
import { OutcomesChipInput } from "@/features/workflows/workflow-properties/outcomes-chip-input";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";

/**
 * `dynamic-outcomes` UIHint — edits the activity's outcome list (the names
 * that downstream flow connections can target). Stored as a naked
 * `outcomes: string[]` field on the activity, matching Blazor.
 *
 * The wrapping syntax selector is intentionally omitted: outcomes are
 * always a literal list — they can't be an expression.
 */
export function DynamicOutcomesHint({ ctx }: { ctx: HintContext }) {
  const current = readOutcomes(ctx.activity as Record<string, unknown>);

  const setOutcomes = (next: string[]) => {
    // Stored as naked top-level `outcomes`, not under the descriptor's name.
    // The InputRow scaffolding writes to `descriptor.name`, so reach past
    // setRaw via the editor store. We achieve this by encoding the value
    // back through setRaw which, because descriptor.name === "Outcomes" in
    // practice for this hint, lands at activity.outcomes (camelized).
    ctx.setRaw(next);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium">
        {ctx.descriptor.displayName ?? "Outcomes"}
      </Label>
      <OutcomesChipInput
        value={current}
        onChange={setOutcomes}
        readOnly={ctx.readOnly}
        placeholder="Add outcome and press Enter"
      />
      {ctx.descriptor.description ? (
        <p className="text-muted-foreground text-xs">{ctx.descriptor.description}</p>
      ) : null}
    </div>
  );
}

function readOutcomes(activity: Record<string, unknown>): string[] {
  const raw = activity.outcomes;
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  return [];
}
