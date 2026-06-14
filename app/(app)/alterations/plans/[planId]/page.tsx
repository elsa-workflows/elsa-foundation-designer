import { PlanDetails } from "@/features/alterations/plan-details";

export const metadata = { title: "Alteration plan" };

export default async function Page({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;
  return <PlanDetails planId={planId} />;
}
