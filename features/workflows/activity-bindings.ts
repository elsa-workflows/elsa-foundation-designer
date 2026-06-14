/**
 * Pure helpers for extracting workflow-state references off an activity:
 *   - Reads: inputs whose `expression.type` is `"Variable"` or `"Input"` — these
 *     pull a value from a workflow variable or workflow input.
 *   - Writes: output bindings whose `memoryReference.id` matches a declared
 *     workflow variable id or workflow output name.
 *
 * Used by the canvas card to show a small "↓ Email · ↑ Counter" chip strip,
 * so operators can see at a glance which activities touch workflow state.
 *
 * JavaScript / Liquid expressions are NOT inspected — surfacing `vars.X`
 * references would require parsing the expression body, which is too
 * uncertain to back a UI affordance.
 */

import {
  readOutputBinding,
  readWrappedInput,
} from "@/features/workflows/activity-properties/input-value";
import {
  readInputRef,
  readVariableRef,
} from "@/features/workflows/variable-reference";
import type {
  ActivityDescriptor,
  ActivityJson,
  InputDefinition,
  OutputDefinition,
  VariableDefinition,
} from "@/lib/api/types";

export type BindingKind = "variable" | "input" | "output";

export type BindingRef = {
  kind: BindingKind;
  /** Stable identifier (variable id, input/output name). */
  key: string;
  /** Friendly label rendered in the chip. */
  name: string;
  /** Optional descriptor — name of the activity property the binding lives on. */
  via?: string;
  /** True when the target no longer exists on the workflow definition. */
  missing?: boolean;
};

export type ActivityBindings = {
  reads: BindingRef[];
  writes: BindingRef[];
};

/**
 * Inspect an activity against the workflow's declared variables / inputs /
 * outputs and produce a flat read/write summary. Returns an empty
 * `{ reads: [], writes: [] }` when there's nothing to surface — callers
 * can use that to skip rendering the chip strip.
 */
export function extractBindings(
  activity: ActivityJson | null | undefined,
  descriptor: ActivityDescriptor | null | undefined,
  scope: {
    variables: ReadonlyArray<VariableDefinition>;
    inputs: ReadonlyArray<InputDefinition>;
    outputs: ReadonlyArray<OutputDefinition>;
  },
): ActivityBindings {
  if (!activity || !descriptor) return { reads: [], writes: [] };

  const activityObj = activity as Record<string, unknown>;
  const variablesById = new Map(scope.variables.map((v) => [v.id, v]));
  const inputsByName = new Map(scope.inputs.map((i) => [i.name, i]));
  const outputsByName = new Map(scope.outputs.map((o) => [o.name, o]));

  const reads: BindingRef[] = [];
  for (const input of descriptor.inputs ?? []) {
    if (input.isBrowsable === false) continue;
    // Naked inputs (`isWrapped: false`) carry raw values, not expression
    // envelopes — there's no `expression.type` to read. We could inspect
    // them for embedded variable objects, but the variable-picker hint
    // already handles that case visually, so skip here to avoid duplication.
    if (input.isWrapped === false) continue;

    const wrapped = readWrappedInput(activityObj, input);
    const exprType = wrapped.expression?.type;
    if (exprType !== "Variable" && exprType !== "Input") continue;
    const raw = wrapped.expression?.value;

    if (exprType === "Variable") {
      const ref = readVariableRef(raw);
      if (!ref) continue;
      const v = variablesById.get(ref.id);
      reads.push({
        kind: "variable",
        key: ref.id,
        name: v?.name ?? ref.name ?? ref.id,
        via: input.displayName?.trim() || input.name,
        missing: !v,
      });
    } else {
      const ref = readInputRef(raw);
      if (!ref) continue;
      const wi = inputsByName.get(ref.name);
      reads.push({
        kind: "input",
        key: ref.name,
        name: wi?.displayName?.trim() || ref.displayName?.trim() || ref.name,
        via: input.displayName?.trim() || input.name,
        missing: !wi,
      });
    }
  }

  const writes: BindingRef[] = [];
  for (const output of descriptor.outputs ?? []) {
    if (output.isBrowsable === false) continue;
    const binding = readOutputBinding(activityObj, output);
    const id = binding.memoryReference?.id;
    if (!id) continue;

    const variable = variablesById.get(id);
    if (variable) {
      writes.push({
        kind: "variable",
        key: variable.id,
        name: variable.name,
        via: output.displayName?.trim() || output.name,
      });
      continue;
    }
    const wo = outputsByName.get(id);
    if (wo) {
      writes.push({
        kind: "output",
        key: wo.name,
        name: wo.displayName?.trim() || wo.name,
        via: output.displayName?.trim() || output.name,
      });
      continue;
    }
    // The binding points at something that's neither a known variable nor a
    // known output — most likely a recently-renamed/deleted target. Surface
    // it as a missing variable so the chip flags it.
    writes.push({
      kind: "variable",
      key: id,
      name: id,
      via: output.displayName?.trim() || output.name,
      missing: true,
    });
  }

  return { reads, writes };
}
