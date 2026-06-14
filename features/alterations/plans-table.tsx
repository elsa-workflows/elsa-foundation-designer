"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  ClipboardList,
  ExternalLink,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanStatusBadge } from "@/features/alterations/plan-status-badge";
import {
  FilterToolbar,
  ListEmptyState,
  ListPagination,
} from "@/features/workflows/list-page-shell";
import { useDebouncedValue } from "@/features/workflows/use-debounced";
import {
  useAlterationPlan,
  useAlterationPlans,
} from "@/lib/api/alterations";
import { useGlobalInstanceEvents } from "@/lib/api/signalr";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 25;

export function PlansTable() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 250);
  const qc = useQueryClient();

  const q = useAlterationPlans({
    page,
    pageSize: PAGE_SIZE,
    correlationId: debouncedSearch || undefined,
  });

  // SignalR updates can affect either the list of plans (new instances) OR
  // an individual plan's status / jobs. Invalidate both query roots.
  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["workflow-instances"] });
    qc.invalidateQueries({ queryKey: ["alteration-plan"] });
  }, [qc]);
  useGlobalInstanceEvents(invalidate);

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const total = q.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + items.length;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <FilterToolbar>
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by plan id…"
            className="pl-8"
          />
          {search ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Clear search"
              onClick={() => {
                setSearch("");
                setPage(0);
              }}
              className="absolute top-1/2 right-1 -translate-y-1/2"
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {q.isFetching ? "Refreshing…" : total > 0 ? `${first}–${last} of ${total}` : "No results"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            aria-label="Refresh"
            title="Refresh now"
          >
            <RefreshCw className={`size-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </FilterToolbar>

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs ring-1 ring-black/[0.02] dark:ring-white/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%] pl-3">Plan id</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="hidden md:table-cell">Finished</TableHead>
              <TableHead className="w-8 pr-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isPending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : q.isError ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-destructive py-8 text-center text-sm"
                >
                  Couldn&apos;t load alteration plans.
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <ListEmptyState
                    icon={ClipboardList}
                    title={
                      debouncedSearch
                        ? "No matches"
                        : "No alteration plans yet"
                    }
                    description={
                      debouncedSearch
                        ? `Nothing matches “${debouncedSearch}”. Try a different plan id.`
                        : "Submit an alteration from a running instance and the plan will show up here."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((i) => {
                const planId = i.correlationId ?? i.id;
                return (
                  <PlanRow
                    key={i.id}
                    planId={planId}
                    createdAt={i.createdAt}
                    onOpen={() => router.push(`/alterations/plans/${planId}`)}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ListPagination
        page={page}
        totalPages={totalPages}
        first={first}
        last={last}
        total={total}
        busy={q.isFetching}
        onPrev={() => setPage((p) => Math.max(0, p - 1))}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}

/**
 * Single row in the plans table. Fetches the authoritative plan payload via
 * `/alterations/{id}` so the State + Jobs columns stay in sync with the Plan
 * Details page. Workflow-instance status can lag behind plan status (the
 * execution workflow may still be wrapping up after the plan reports
 * Completed), so we don't rely on it for these columns.
 *
 * React Query dedupes by `["alteration-plan", planId]` — clicking through to
 * the Plan Details page reuses the same cache entry, no extra fetch.
 */
function PlanRow({
  planId,
  createdAt,
  onOpen,
}: {
  planId: string;
  createdAt: string;
  onOpen: () => void;
}) {
  const planQ = useAlterationPlan(planId);
  const plan = planQ.data?.plan;
  const jobs = planQ.data?.jobs;

  const jobsLabel = jobs
    ? `${jobs.filter((j) => j.status === "Completed").length}/${jobs.length}`
    : "—";
  const hasFailedJob = jobs?.some((j) => j.status === "Failed") ?? false;

  const finishedAt = plan?.completedAt;

  return (
    <TableRow
      className="group hover:bg-muted/40 cursor-pointer"
      onClick={onOpen}
    >
      <TableCell className="pl-3 font-medium">
        <span className="block truncate font-mono text-xs" title={planId}>
          {planId}
        </span>
      </TableCell>
      <TableCell>
        {planQ.isPending ? (
          <Skeleton className="h-5 w-20" />
        ) : (
          <PlanStatusBadge status={plan?.status} />
        )}
      </TableCell>
      <TableCell className="text-xs">
        {planQ.isPending ? (
          <Skeleton className="h-4 w-12" />
        ) : (
          <span className="flex items-center gap-1.5">
            <span className="tabular-nums">{jobsLabel}</span>
            {hasFailedJob ? (
              <Badge
                variant="outline"
                className="border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 px-1 py-0 text-[9px] font-normal leading-tight"
              >
                failed
              </Badge>
            ) : null}
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
        {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
      </TableCell>
      <TableCell className="text-muted-foreground hidden whitespace-nowrap text-xs md:table-cell">
        {finishedAt ? format(new Date(finishedAt), "yyyy-MM-dd HH:mm") : "—"}
      </TableCell>
      <TableCell className="pr-3 text-right">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Open plan"
          onClick={(e) => e.stopPropagation()}
          render={<Link href={`/alterations/plans/${planId}`} />}
        >
          <ExternalLink className="size-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
