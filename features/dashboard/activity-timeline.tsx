"use client";

import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/auth/use-session";
import { StatusBadge } from "@/features/dashboard/status-badge";
import { useWorkflowInstances } from "@/lib/api/elsa";

export function ActivityTimeline() {
  const { session } = useSession();
  const q = useWorkflowInstances({
    pageSize: 10,
    orderBy: "UpdatedAt",
    orderDirection: "Descending",
  });

  const items = q.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Activity timeline</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <ScrollArea className="h-56">
          {session && q.isPending ? (
            <div className="space-y-3 pr-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <ol className="relative space-y-3 pr-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-border">
              {items.map((i) => (
                <li key={i.id} className="relative pl-7">
                  <span className="absolute left-[5px] top-1.5 size-1.5 rounded-full bg-primary ring-4 ring-background" />
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {i.name?.trim() || (
                        <span className="font-mono text-xs text-muted-foreground">
                          {i.id.slice(0, 8)}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="mt-0.5">
                    <StatusBadge status={i.subStatus} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
