import { AlterableInstancesTable } from "@/features/alterations/alterable-instances-table";
import {
  ListPageHeader,
  ListPageShell,
} from "@/features/workflows/list-page-shell";

export const metadata = { title: "Alterable instances" };

export default function Page() {
  return (
    <ListPageShell kind="alteration-instances">
      <ListPageHeader
        kind="alteration-instances"
        title="Alterable Instances"
        description="Pick a running workflow instance to alter — cancel activities, modify variables or dispatch events on the live run."
      />
      <AlterableInstancesTable />
    </ListPageShell>
  );
}
