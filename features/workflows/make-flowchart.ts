import { makeActivity } from "@/features/workflows/make-activity";
import type { ActivityDescriptor, ActivityJson } from "@/lib/api/types";

const FLOWCHART_TYPE = "Elsa.Flowchart";
const FLOWCHART_LONG_TYPE = "Elsa.Workflows.Activities.Flowchart";

/**
 * Build a fresh, empty Flowchart activity. Mirrors Blazor's
 * `OnActivityEmbeddedPortSelected` which synthesises a new Flowchart when
 * the user clicks an empty embedded port (`DiagramDesignerWrapper.razor.cs`
 * lines 572–581). The Blazor designer always emits the short type name
 * `Elsa.Flowchart`, hardcoded `customProperties` defaults, and empty
 * `activities` / `variables` / `connections` arrays — we match that shape
 * so workflows round-trip byte-for-byte.
 */
export function makeFlowchart(
  descriptors: ActivityDescriptor[],
  parentNodeId: string = "",
  workflowRoot: ActivityJson | null = null,
): ActivityJson {
  // Prefer the short type name. Fall back to whichever descriptor the catalog
  // exposes so version/constructionProperties are honoured.
  const descriptor =
    descriptors.find((d) => d.typeName === FLOWCHART_TYPE) ??
    descriptors.find((d) => d.typeName === FLOWCHART_LONG_TYPE);
  const base = makeActivity(FLOWCHART_TYPE, descriptor, null, parentNodeId, workflowRoot);
  const descriptorCustom = (base.customProperties as Record<string, unknown> | undefined) ?? {};
  return {
    ...base,
    // Force the short Blazor-emitted type name even if the descriptor uses
    // the long namespace form.
    type: FLOWCHART_TYPE,
    metadata: base.metadata ?? {},
    customProperties: {
      notFoundConnections: [],
      canStartWorkflow: false,
      runAsynchronously: false,
      ...descriptorCustom,
    },
    activities: [],
    variables: [],
    connections: [],
  };
}
