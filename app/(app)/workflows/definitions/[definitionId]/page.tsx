import { DefinitionViewer } from "@/features/workflows/definition-viewer";

export const metadata = { title: "Workflow Definition" };

export default async function Page({
  params,
}: {
  params: Promise<{ definitionId: string }>;
}) {
  const { definitionId } = await params;
  return <DefinitionViewer definitionId={definitionId} />;
}
