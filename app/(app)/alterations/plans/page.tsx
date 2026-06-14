import { PlansTable } from "@/features/alterations/plans-table";
import {
  ListPageHeader,
  ListPageShell,
} from "@/features/workflows/list-page-shell";

export const metadata = { title: "Alteration Plans" };

export default function Page() {
  return (
    <ListPageShell kind="alteration-plans">
      <ListPageHeader
        kind="alteration-plans"
        title="Alteration Plans"
        description="Inspect plans the server is or has been executing. The list refreshes as the server pushes workflow updates."
      />
      <PlansTable />
    </ListPageShell>
  );
}
