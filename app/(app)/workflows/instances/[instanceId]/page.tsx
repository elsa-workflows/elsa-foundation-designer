import { InstanceViewer } from "@/features/workflows/instance-viewer";

export const metadata = { title: "Workflow Instance" };

export default async function Page({
  params,
}: {
  params: Promise<{ instanceId: string }>;
}) {
  const { instanceId } = await params;
  return <InstanceViewer instanceId={instanceId} />;
}
