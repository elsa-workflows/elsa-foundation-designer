"use client";

import { ArrowRight, ExternalLink, Pencil } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { BindingRef } from "@/features/workflows/activity-bindings";
import {
  useEditorStore,
  type PropertiesSubTab,
} from "@/features/workflows/editor-store";
import type { VariableDefinition } from "@/lib/api/types";

const KIND_LABEL: Record<BindingRef["kind"], string> = {
  variable: "Variable",
  input: "Workflow input",
  output: "Workflow output",
};

const KIND_TONE: Record<BindingRef["kind"], string> = {
  variable:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  input: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  output:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200",
};

const KIND_SUBTAB: Record<BindingRef["kind"], PropertiesSubTab> = {
  variable: "variables",
  input: "io",
  output: "io",
};

/**
 * Corner-row pencil badge that opens a modal explaining what workflow state
 * the activity mutates, and why. Replaces the earlier "tooltip on hover" so
 * the user gets a focused view with names, default values, and a one-click
 * jump to the workflow Properties tab to inspect each target.
 *
 * Only renders when there's at least one resolved write — missing references
 * are still surfaced separately in the bindings popover at the bottom of
 * the card.
 */
export function ActivityMutationsButton({
  activityName,
  writes,
  variables,
}: {
  activityName: string;
  writes: BindingRef[];
  variables: ReadonlyArray<VariableDefinition>;
}) {
  const variablesById = new Map(variables.map((v) => [v.id, v]));
  const setTab = useEditorStore((s) => s.setTab);
  const setSubTab = useEditorStore((s) => s.setPropertiesSubTab);

  return (
    <Dialog>
      <DialogTrigger
        className="flex size-4 items-center justify-center rounded-full bg-background ring-1 ring-violet-500/60 shadow-sm transition-colors hover:bg-violet-500/10 focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
        // The badge sits inside an activity card; React Flow listens for
        // mouse-down on the node to start drags. Stop the event so clicking
        // the badge doesn't also drag/select the activity.
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="Show what workflow state this activity modifies"
        title="Show what this activity changes"
      >
        <Pencil className="size-2.5 text-violet-600" strokeWidth={2.5} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>What this activity changes</DialogTitle>
          <DialogDescription>
            {plural(writes.length, "write")} on the workflow definition.{" "}
            <strong>{activityName}</strong> assigns to the targets below when
            it runs — clicking an entry opens it in the workflow Properties
            panel so you can review or edit it.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y rounded-md border bg-muted/20">
          {writes.map((w, idx) => {
            const variable =
              w.kind === "variable" ? variablesById.get(w.key) : null;
            const currentValue =
              variable?.value !== null && variable?.value !== undefined
                ? formatValue(variable.value)
                : null;
            // Include `idx` in the key — two output slots can bind to the
            // same variable id, so `kind:key` alone isn't unique. The `via`
            // (property name) would be unique too, but index is bulletproof.
            return (
              <li key={`${idx}:${w.kind}:${w.key}`}>
                <button
                  type="button"
                  onClick={() => {
                    setTab("properties");
                    setSubTab(KIND_SUBTAB[w.kind]);
                  }}
                  className="group flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm outline-none transition-colors hover:bg-muted/60 focus-visible:bg-muted/60"
                >
                  <span
                    className={[
                      "mt-0.5 inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-2xs leading-none",
                      KIND_TONE[w.kind],
                    ].join(" ")}
                  >
                    {KIND_LABEL[w.kind]}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 leading-tight">
                    <span className="truncate font-medium">{w.name}</span>
                    {w.via ? (
                      <span className="text-muted-foreground text-xs">
                        Set via the <code className="text-2xs">{w.via}</code>{" "}
                        property
                      </span>
                    ) : null}
                    {variable ? (
                      <span className="text-muted-foreground text-xs">
                        Type{" "}
                        <code className="text-2xs">
                          {shortType(variable.typeName)}
                        </code>
                        {currentValue
                          ? ` · current default: ${currentValue}`
                          : " · no default value"}
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight className="text-muted-foreground/60 group-hover:text-foreground mt-1 size-3.5 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
        <div className="text-muted-foreground flex items-start gap-2 rounded-md border bg-muted/30 p-2 text-xs">
          <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Workflow variables persist across the run, so a write here is
            visible to every activity that reads the same variable afterwards.
            Workflow outputs become part of the result the workflow returns to
            its caller.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function plural(n: number, word: string): string {
  return n === 1 ? `1 ${word}` : `${n} ${word}s`;
}

function shortType(typeName: string): string {
  const noGenerics = typeName.split("`")[0];
  const segs = noGenerics.split(".");
  return segs[segs.length - 1] ?? typeName;
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "string") return v.length > 60 ? `${v.slice(0, 57)}…` : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  } catch {
    return String(v);
  }
}
