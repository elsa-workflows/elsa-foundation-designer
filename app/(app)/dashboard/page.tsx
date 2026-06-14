import { ActivityChart } from "@/features/dashboard/activity-chart";
import { ActivityTimeline } from "@/features/dashboard/activity-timeline";
import { RecentInstances } from "@/features/dashboard/recent-instances";
import {
  StatFailed24h,
  StatPublished,
  StatRunning,
  StatTotalDefinitions,
} from "@/features/dashboard/stats";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Operational view of your workflow definitions and instances.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTotalDefinitions />
        <StatPublished />
        <StatRunning />
        <StatFailed24h />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ActivityChart />
        <ActivityTimeline />
      </div>

      <RecentInstances />
    </main>
  );
}
