"use client";

import { useCallback, useMemo, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { camelize } from "@/features/workflows/activity-properties/input-value";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { resolveHint } from "@/features/workflows/activity-properties/hints/registry";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import type { ActivityDescriptor, ActivityJson, InputDescriptor } from "@/lib/api/types";

type Props = {
  activity: ActivityJson;
  descriptor: ActivityDescriptor | null;
};

const GENERAL_KEY = "__general__";

/**
 * Renders the descriptor-declared inputs. When the activity declares multiple
 * categories, each one gets its own tab strip; otherwise the inputs are shown
 * as a single flat list. Every input row goes through the hint registry and
 * is wrapped in `InputRow` chrome (label + tooltip + syntax menu).
 */
export function ActivityInputsTab({ activity, descriptor }: Props) {
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);

  const inputs = useMemo(
    () =>
      (descriptor?.inputs ?? [])
        .filter((i) => i.isBrowsable !== false)
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [descriptor?.inputs],
  );

  const inputDescriptorsByName = useMemo(() => {
    const map = new Map<string, InputDescriptor>();
    for (const i of descriptor?.inputs ?? []) map.set(i.name, i);
    return map;
  }, [descriptor?.inputs]);

  const setRaw = useCallback(
    (descriptorName: string, value: unknown) => {
      if (!root) return;
      // Naked inputs (`isWrapped: false` — e.g. `SetVariable.Variable` typed as
      // `Variable?` rather than `Input<Variable>`) store their value directly
      // at `activity.<camelize(name)>` — no envelope. The hint authoring
      // surface, however, is uniform: hints read via `readWrappedInput` (which
      // fakes an envelope for naked inputs) and write via `withLiteralValue`
      // (which produces an envelope). If we pass that envelope straight into
      // a naked slot the server can't deserialise it back into the bare type
      // and the binding is silently dropped on save.
      //
      // Detect the envelope shape that hints universally emit and unwrap it
      // here so the activity ends up holding just the raw literal value.
      // Hints that need to write a complex naked shape directly (e.g. the
      // variable picker's naked branch writing a `Variable` object) pass an
      // object without an `expression` field, which falls through unchanged.
      const desc = inputDescriptorsByName.get(descriptorName);
      let writeValue = value;
      if (desc?.isWrapped === false && value && typeof value === "object") {
        const env = value as {
          expression?: { value?: unknown };
          typeName?: unknown;
        };
        // The envelope `withLiteralValue` produces always carries a string
        // `typeName` and an `expression: { value }` pair. Require both so an
        // application-level value that happens to have a key called
        // `expression` doesn't get mis-detected as an envelope.
        if (
          typeof env.typeName === "string" &&
          env.expression &&
          typeof env.expression === "object" &&
          "value" in env.expression
        ) {
          writeValue = env.expression.value;
        }
      }
      setRoot(
        updateActivity(root, activity.id, (a) => {
          const next = { ...a } as Record<string, unknown>;
          const key = camelize(descriptorName);
          if (writeValue === undefined || writeValue === null) {
            delete next[key];
          } else {
            next[key] = writeValue;
          }
          return next as ActivityJson;
        }),
      );
    },
    [activity.id, root, setRoot, inputDescriptorsByName],
  );

  const groups = useMemo(() => groupByCategory(inputs), [inputs]);
  const firstCategoryKey = groups[0] ? (groups[0].category ?? GENERAL_KEY) : GENERAL_KEY;
  const [activeCategory, setActiveCategory] = useState(firstCategoryKey);

  if (!descriptor) {
    return (
      <p className="text-muted-foreground text-xs">
        No descriptor available for this activity type.
      </p>
    );
  }
  if (inputs.length === 0) {
    return <p className="text-muted-foreground text-xs">This activity has no inputs.</p>;
  }

  const renderItems = (items: InputDescriptor[]) => (
    <div className="flex flex-col gap-4">
      {items.map((input) => {
        const Hint = resolveHint(input.uiHint);
        const ctx: HintContext = {
          activity,
          descriptor: input,
          readOnly,
          setRaw: (v) => setRaw(input.name, v),
        };
        return <Hint key={input.name} ctx={ctx} />;
      })}
    </div>
  );

  // Single category (categorised or not): no tab strip needed.
  if (groups.length <= 1) {
    return renderItems(groups[0]?.items ?? inputs);
  }

  return (
    <Tabs value={activeCategory} onValueChange={setActiveCategory} className="gap-0">
      <TabsList
        variant="line"
        className="h-9 w-full justify-start gap-4 rounded-none border-b bg-transparent px-0"
      >
        {groups.map((g) => {
          const key = g.category ?? GENERAL_KEY;
          const label = g.category ?? "General";
          return (
            <TabsTrigger key={key} value={key} className="px-1">
              <span>{label}</span>
              <span
                className={[
                  "rounded-full px-1.5 py-px text-2xs font-medium tabular-nums",
                  activeCategory === key
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {g.items.length}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      {groups.map((g) => {
        const key = g.category ?? GENERAL_KEY;
        return (
          <TabsContent key={key} value={key} className="pt-5">
            {renderItems(g.items)}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

function groupByCategory(
  inputs: InputDescriptor[],
): { category: string | null; items: InputDescriptor[] }[] {
  // Stable order, but inputs without a category float to the top under a null heading.
  const buckets = new Map<string, InputDescriptor[]>();
  const ungrouped: InputDescriptor[] = [];
  for (const i of inputs) {
    const cat = i.category?.trim();
    if (!cat) {
      ungrouped.push(i);
      continue;
    }
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat)!.push(i);
  }
  const out: { category: string | null; items: InputDescriptor[] }[] = [];
  if (ungrouped.length > 0) out.push({ category: null, items: ungrouped });
  for (const [cat, items] of [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    out.push({ category: cat, items });
  }
  return out;
}
