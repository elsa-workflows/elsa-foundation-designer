import { makeActivity } from "@/features/workflows/make-activity";
import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

const STATE_MACHINE_TYPE = "Elsa.StateMachine";
const STATE_MACHINE_LONG_TYPE = "Elsa.Workflows.Activities.StateMachine";

/**
 * Build a fresh, empty StateMachine activity. The wire shape carries empty
 * `states[]` and `transitions[]`; `initialState` is omitted until the first
 * state is added (the store's `addStateMachineState` promotes the first
 * state added to initial automatically).
 */
export function makeStateMachine(
  descriptors: ActivityDescriptor[],
  parentNodeId: string = "",
  workflowRoot: ActivityJson | null = null,
): ActivityJson {
  const descriptor =
    descriptors.find((d) => d.typeName === STATE_MACHINE_TYPE) ??
    descriptors.find((d) => d.typeName === STATE_MACHINE_LONG_TYPE);
  const base = makeActivity(STATE_MACHINE_TYPE, descriptor, null, parentNodeId, workflowRoot);
  const descriptorCustom = (base.customProperties as Record<string, unknown> | undefined) ?? {};
  return {
    ...base,
    type: STATE_MACHINE_TYPE,
    metadata: base.metadata ?? {},
    customProperties: {
      canStartWorkflow: false,
      runAsynchronously: false,
      ...descriptorCustom,
    },
    states: [],
    transitions: [],
    variables: [],
  };
}
