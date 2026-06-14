import { AlterationDesignerHost } from "@/features/alterations/designer-host";

export const metadata = { title: "Alter instance" };

export default async function Page({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  return <AlterationDesignerHost instanceId={instanceId} />;
}
