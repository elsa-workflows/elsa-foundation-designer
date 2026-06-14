import { Badge } from "@/components/ui/badge";
import type { AlterationPlanStatus } from "@/lib/api/alterations";

/**
 * Authoritative plan status, sourced from the /alterations/{id} endpoint.
 * The underlying workflow-instance status can lag behind these values (the
 * plan can report Completed while the execution workflow is still wrapping
 * up), so this badge MUST be driven from `plan.status`, not the instance.
 */
export function PlanStatusBadge({
  status,
}: {
  status: AlterationPlanStatus | undefined;
}) {
  if (!status) {
    return <Badge variant="secondary">Unknown</Badge>;
  }
  if (
    status === "Running" ||
    status === "Dispatching" ||
    status === "Generating"
  ) {
    return (
      <Badge className="border-sky-600 bg-sky-500 text-white">{status}</Badge>
    );
  }
  if (status === "Completed") {
    return (
      <Badge className="border-emerald-600 bg-emerald-500 text-white">
        Completed
      </Badge>
    );
  }
  if (status === "Failed") {
    return (
      <Badge className="border-rose-600 bg-rose-500 text-white">Failed</Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}
