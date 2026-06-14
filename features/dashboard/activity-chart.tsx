"use client";

import { eachDayOfInterval, format, startOfDay, subDays } from "date-fns";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/use-session";
import { useWorkflowInstances } from "@/lib/api/elsa";
import type { WorkflowInstanceSummary, WorkflowSubStatus } from "@/lib/api/types";

const RANGE_DAYS = 7;

/**
 * Each bar series the chart renders, in stacking order (bottom → top).
 * The dataKey matches the field on each bucket; the color comes from the
 * Elsa palette and the chart-N CSS variables.
 */
const SERIES: ReadonlyArray<{
  key: WorkflowSubStatus;
  name: string;
  color: string;
}> = [
  { key: "Finished", name: "Finished", color: "var(--chart-2)" },
  { key: "Suspended", name: "Suspended", color: "var(--chart-4)" },
  { key: "Cancelled", name: "Cancelled", color: "var(--muted-foreground)" },
  { key: "Faulted", name: "Faulted", color: "var(--destructive)" },
];

type Bucket = {
  day: Date;
  label: string;
} & Record<WorkflowSubStatus, number>;

export function ActivityChart() {
  const { session } = useSession();
  // Elsa's /workflow-instances endpoint accepts only structured
  // `TimestampFilters`, not a `createdAtFrom` scalar — so we ask for the 500
  // most-recent rows and bucket them client-side. Anything older than 7 days
  // drops out of the bucket findIndex naturally.
  const q = useWorkflowInstances({
    pageSize: 500,
    orderBy: "Created",
    orderDirection: "Descending",
  });

  const { data, totalInWindow, totalReceived, totalOnServer } = useMemo(() => {
    const buckets: Bucket[] = eachDayOfInterval({
      start: subDays(startOfDay(new Date()), RANGE_DAYS - 1),
      end: new Date(),
    }).map((day) => ({
      day,
      label: format(day, "EEE d"),
      Executing: 0,
      Pending: 0,
      Suspended: 0,
      Finished: 0,
      Cancelled: 0,
      Faulted: 0,
    }));

    const items = q.data?.items ?? [];
    let inWindow = 0;
    for (const i of items) {
      const ts = parseCreatedAt(i);
      if (ts === null) continue;
      const idx = buckets.findIndex(
        (b) => ts >= b.day.getTime() && ts < b.day.getTime() + 24 * 60 * 60 * 1000,
      );
      if (idx < 0) continue;
      const sub = i.subStatus as WorkflowSubStatus | undefined;
      if (sub && sub in buckets[idx]) {
        buckets[idx][sub] += 1;
      }
      inWindow += 1;
    }

    return {
      data: buckets,
      totalInWindow: inWindow,
      totalReceived: items.length,
      totalOnServer: q.data?.totalCount ?? 0,
    };
  }, [q.data]);

  // Y-axis upper bound: max stacked-sum across visible series. Floor at 1 so
  // the chart isn't a flat zero-height bar when a single instance lands.
  const maxStack = useMemo(
    () =>
      data.reduce(
        (m, b) => Math.max(m, SERIES.reduce((s, ser) => s + b[ser.key], 0)),
        0,
      ),
    [data],
  );

  return (
    <Card className="col-span-1 xl:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Activity, last 7 days</CardTitle>
        {!q.isPending && totalReceived > 0 ? (
          <span className="text-muted-foreground text-[10.5px]">
            {totalInWindow} in window · {totalOnServer} total
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="h-56">
        {session && q.isPending ? (
          <Skeleton className="h-full w-full" />
        ) : q.isError ? (
          <div className="text-destructive flex h-full items-center justify-center text-xs">
            Couldn&apos;t load workflow instances.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 16, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                domain={[0, Math.max(1, maxStack)]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklch, var(--muted) 50%, transparent)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  fontSize: "12px",
                  color: "var(--popover-foreground)",
                }}
              />
              <Legend
                iconType="square"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              />
              {SERIES.map((s, i) => {
                const isTop = i === SERIES.length - 1;
                return (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    stackId="status"
                    fill={s.color}
                    radius={isTop ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  >
                    {isTop ? (
                      <LabelList
                        position="top"
                        className="fill-muted-foreground"
                        fontSize={10}
                        valueAccessor={(entry: unknown) => {
                          const b = entry as Bucket;
                          const total = SERIES.reduce((sum, ser) => sum + b[ser.key], 0);
                          return total > 0 ? String(total) : "";
                        }}
                      />
                    ) : null}
                  </Bar>
                );
              })}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Returns the millisecond timestamp of a workflow instance's creation, or
 * null if no usable timestamp is present. Tolerates camelCase / PascalCase
 * field naming and missing values.
 */
function parseCreatedAt(i: WorkflowInstanceSummary): number | null {
  const raw =
    (i.createdAt as string | undefined) ??
    (i as unknown as { CreatedAt?: string }).CreatedAt;
  if (!raw) return null;
  const t = new Date(raw).getTime();
  return Number.isFinite(t) ? t : null;
}
