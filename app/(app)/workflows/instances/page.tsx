import { InstancesTable } from "@/features/workflows/instances-table";
import {
  ListPageHeader,
  ListPageShell,
} from "@/features/workflows/list-page-shell";

export const metadata = { title: "Workflow Instances" };

export default function WorkflowInstancesPage() {
  return (
    <ListPageShell kind="instances">
      <ListPageHeader
        kind="instances"
        title="Workflow Instances"
        description="Inspect running, suspended, completed and faulted runs. Click any row to follow the execution."
      />
      <InstancesTable />
    </ListPageShell>
  );
}
