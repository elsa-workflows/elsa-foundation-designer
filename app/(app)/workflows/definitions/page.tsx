import { DefinitionsTable } from "@/features/workflows/definitions-table";
import {
  ListPageHeader,
  ListPageShell,
} from "@/features/workflows/list-page-shell";

export const metadata = { title: "Workflow Definitions" };

export default function WorkflowDefinitionsPage() {
  return (
    <ListPageShell kind="definitions">
      <ListPageHeader
        kind="definitions"
        title="Workflow Definitions"
        description="Browse the workflows registered with this Elsa server. Click any row to inspect its graph."
      />
      <DefinitionsTable />
    </ListPageShell>
  );
}
