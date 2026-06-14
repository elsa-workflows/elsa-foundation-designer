"use client";

import { useMemo } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  camelize,
  readOutputBinding,
  type OutputBindingValue,
} from "@/features/workflows/activity-properties/input-value";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import type {
  ActivityDescriptor,
  ActivityJson,
  OutputDescriptor,
} from "@/lib/api/types";

type Props = {
  activity: ActivityJson;
  descriptor: ActivityDescriptor | null;
};

const NONE_VALUE = "__none__";

/**
 * Per-output binding: choose a variable or a workflow output by id. We never
 * mutate the descriptor itself — it's metadata. The binding lives at
 * `camelize(descriptor.name)` on the activity, shaped like:
 *
 *   { typeName: "<descriptor.typeName>", memoryReference: { id: "<chosen>" } }
 *
 * Pick "—" to clear the binding.
 */
export function ActivityOutputsTab({ activity, descriptor }: Props) {
  const variables = useEditorStore((s) => s.definition?.variables ?? []);
  const workflowOutputs = useEditorStore((s) => s.definition?.outputs ?? []);
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);

  // value → label map shared across every output's Select. Tells base-ui to
  // render the trigger with the human label rather than the raw id/name.
  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { [NONE_VALUE]: "— (not bound)" };
    for (const v of variables) map[v.id] = v.name;
    for (const o of workflowOutputs) map[o.name] = o.displayName || o.name;
    return map;
  }, [variables, workflowOutputs]);

  if (!descriptor) {
    return (
      <p className="text-muted-foreground text-xs">No descriptor available for this activity type.</p>
    );
  }

  const outputs = descriptor.outputs.filter((o) => o.isBrowsable !== false);
  if (outputs.length === 0) {
    return <p className="text-muted-foreground text-xs">This activity has no outputs.</p>;
  }

  const setBinding = (output: OutputDescriptor, id: string | null) => {
    if (!root) return;
    setRoot(
      updateActivity(root, activity.id, (a) => {
        const next = { ...a } as Record<string, unknown>;
        const key = camelize(output.name);
        if (!id) {
          delete next[key];
        } else {
          const existing = (next[key] as Partial<OutputBindingValue>) ?? {};
          next[key] = {
            typeName: existing.typeName ?? output.typeName,
            memoryReference: { id },
          } satisfies OutputBindingValue;
        }
        return next as ActivityJson;
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {outputs.map((output) => {
        const binding = readOutputBinding(activity as Record<string, unknown>, output);
        const current = binding.memoryReference?.id ?? "";
        const id = `out-${output.name}`;
        const matchingVariable = variables.find((v) => v.id === current);
        return (
          <InputRow key={output.name} descriptor={output} readOnly={readOnly}>
            <Select
              items={items}
              value={current || NONE_VALUE}
              onValueChange={(v) => v && setBinding(output, v === NONE_VALUE ? null : v)}
              disabled={readOnly}
            >
              <SelectTrigger size="sm" id={id}>
                <SelectValue placeholder="Choose a binding…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>— (not bound)</SelectItem>

                {variables.length > 0 ? (
                  <>
                    <SelectGroupLabel>Variables</SelectGroupLabel>
                    {variables.map((v) => (
                      <SelectItem key={`var-${v.id}`} value={v.id}>
                        {v.name}{" "}
                        <span className="text-muted-foreground font-mono text-2xs">
                          {shortTypeName(v.typeName)}
                        </span>
                      </SelectItem>
                    ))}
                  </>
                ) : null}

                {workflowOutputs.length > 0 ? (
                  <>
                    <SelectGroupLabel>Workflow outputs</SelectGroupLabel>
                    {workflowOutputs.map((o) => (
                      <SelectItem key={`wfo-${o.name}`} value={o.name}>
                        {o.displayName || o.name}
                      </SelectItem>
                    ))}
                  </>
                ) : null}
              </SelectContent>
            </Select>

            {matchingVariable ? (
              <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
                Bound to variable <span className="font-mono">{matchingVariable.name}</span>.
              </p>
            ) : null}
          </InputRow>
        );
      })}
    </div>
  );
}

function SelectGroupLabel({ children }: { children: React.ReactNode }) {
  // The shadcn Select component doesn't ship a label primitive; this is a
  // visual-only separator that doesn't interfere with selection.
  return (
    <div className="text-muted-foreground sticky top-0 z-10 bg-popover px-2 py-1 text-2xs font-medium uppercase tracking-wide">
      {children}
    </div>
  );
}

function shortTypeName(name: string): string {
  const noGenerics = name.split("`")[0];
  const segs = noGenerics.split(".");
  return segs[segs.length - 1] ?? name;
}
