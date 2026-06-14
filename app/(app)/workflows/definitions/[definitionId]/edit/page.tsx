import { DefinitionEditor } from "@/features/workflows/definition-editor";

export const metadata = { title: "Edit workflow" };

export default async function Page({
  params,
}: {
  params: Promise<{ definitionId: string }>;
}) {
  const { definitionId } = await params;
  return <DefinitionEditor definitionId={definitionId} />;
}
