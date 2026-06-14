"use client";

import { formatDistanceToNow } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/features/auth/use-session";
import { StatusBadge } from "@/features/dashboard/status-badge";
import { useWorkflowInstances } from "@/lib/api/elsa";

export function RecentInstances() {
  const { session } = useSession();
  const q = useWorkflowInstances({
    pageSize: 10,
    orderBy: "Created",
    orderDirection: "Descending",
  });

  const items = q.data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent instances</CardTitle>
        <span className="text-xs text-muted-foreground">Last 10</span>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right pr-6">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {session && q.isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                  No workflow instances yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    {i.name?.trim() || (
                      <span className="font-mono text-xs text-muted-foreground">
                        {i.id.slice(0, 8)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={i.subStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs text-right pr-6">
                    {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
