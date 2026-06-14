import { makeActivity } from "@/features/workflows/make-activity";
import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

const SEQUENCE_TYPE = "Elsa.Sequence";
const SEQUENCE_LONG_TYPE = "Elsa.Workflows.Activities.Sequence";

/**
 * Build a fresh, empty Sequence activity. Mirrors `makeFlowchart` shape so
 * new sequence-rooted workflows round-trip cleanly through the .NET tier:
 * empty `activities` and `variables`, no `connections` (sequences derive
 * ordering from `activities[]`).
 */
export function makeSequence(
  descriptors: ActivityDescriptor[],
  parentNodeId: string = "",
  workflowRoot: ActivityJson | null = null,
): ActivityJson {
  const descriptor =
    descriptors.find((d) => d.typeName === SEQUENCE_TYPE) ??
    descriptors.find((d) => d.typeName === SEQUENCE_LONG_TYPE);
  const base = makeActivity(SEQUENCE_TYPE, descriptor, null, parentNodeId, workflowRoot);
  const descriptorCustom = (base.customProperties as Record<string, unknown> | undefined) ?? {};
  return {
    ...base,
    type: SEQUENCE_TYPE,
    metadata: base.metadata ?? {},
    customProperties: {
      canStartWorkflow: false,
      runAsynchronously: false,
      ...descriptorCustom,
    },
    activities: [],
    variables: [],
  };
}
