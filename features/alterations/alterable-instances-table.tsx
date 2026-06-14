"use client";

import { formatDistanceToNow } from "date-fns";
import { ListChecks, RefreshCw, Search, Wand2, X } from "lucide-react";
import Link from "next/link";
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
import {
  FilterToolbar,
  ListEmptyState,
  ListPagination,
} from "@/features/workflows/list-page-shell";
import { useDebouncedValue } from "@/features/workflows/use-debounced";
import { useAlterableInstances } from "@/lib/api/alterations";
import { useGlobalInstanceEvents } from "@/lib/api/signalr";
import { useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 25;

export function AlterableInstancesTable() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 250);
  const qc = useQueryClient();

  const q = useAlterableInstances({
    page,
    pageSize: PAGE_SIZE,
    searchTerm: debouncedSearch || undefined,
  });

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["workflow-instances"] });
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
            placeholder="Search by name or id…"
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
              <TableHead className="w-[28%] pl-3">Instance</TableHead>
              <TableHead>Sub-status</TableHead>
              <TableHead className="hidden md:table-cell">Version</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-32 pr-3 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isPending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : q.isError ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-destructive py-8 text-center text-sm"
                >
                  Couldn&apos;t load running instances.
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <ListEmptyState
                    icon={ListChecks}
                    title={
                      debouncedSearch
                        ? "No matches"
                        : "No running instances"
                    }
                    description={
                      debouncedSearch
                        ? `Nothing matches “${debouncedSearch}”. Try a different keyword or clear the search.`
                        : "Start a workflow that suspends or runs long enough to alter — running instances will appear here."
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((i) => (
                <TableRow key={i.id} className="group">
                  <TableCell className="font-medium pl-3">
                    <Link
                      href={`/alterations/instances/${i.id}`}
                      className="hover:text-primary block max-w-md truncate transition-colors"
                    >
                      {i.name?.trim() || (
                        <span className="text-muted-foreground font-mono text-xs">
                          {i.id.slice(0, 8)}
                        </span>
                      )}
                    </Link>
                    <p className="text-muted-foreground truncate text-xs">
                      def {i.definitionId.slice(0, 8)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <SubStatusBadge subStatus={i.subStatus} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                    {i.version ? `v${i.version}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                    {formatDistanceToNow(new Date(i.createdAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell className="pr-3 text-right">
                    <Button
                      size="sm"
                      render={
                        <Link href={`/alterations/instances/${i.id}`} />
                      }
                    >
                      <Wand2 className="size-3.5" />
                      Alter
                    </Button>
                  </TableCell>
                </TableRow>
              ))
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
 * Tinted-outline pills aligned with the instances list's StatusBadge family —
 * consistent colour language across all run-state surfaces.
 */
function SubStatusBadge({ subStatus }: { subStatus: string }) {
  const base = "font-normal";
  if (subStatus === "Executing") {
    return (
      <Badge
        variant="outline"
        className={`${base} border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300`}
      >
        Executing
      </Badge>
    );
  }
  if (subStatus === "Suspended") {
    return (
      <Badge
        variant="outline"
        className={`${base} border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300`}
      >
        Suspended
      </Badge>
    );
  }
  if (subStatus === "Faulted") {
    return (
      <Badge
        variant="outline"
        className={`${base} border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300`}
      >
        Faulted
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={base}>
      {subStatus}
    </Badge>
  );
}
