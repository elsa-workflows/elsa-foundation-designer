"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Download,
  Eye,
  FileBox,
  MoreVertical,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDialog } from "@/features/workflows/confirm-dialog";
import { ImportInstancesButton } from "@/features/workflows/import-instances-button";
import {
  FilterToolbar,
  ListEmptyState,
  ListPagination,
} from "@/features/workflows/list-page-shell";
import { PollingIntervalPicker } from "@/features/workflows/polling-interval-picker";
import { TimeRangeFilter } from "@/features/workflows/time-range-filter";
import { useDebouncedValue } from "@/features/workflows/use-debounced";
import { usePollingInterval } from "@/features/workflows/use-polling-interval";
import {
  useBulkCancelInstances,
  useBulkDeleteInstances,
  useBulkExportInstances,
  useCancelInstance,
  useDeleteInstance,
  useExportInstance,
  useWorkflowDefinitions,
  useWorkflowInstances,
  type InstancesQuery,
} from "@/lib/api/elsa";
import {
  useSubmitAlterations,
  type AlterationWorkflowInstanceFilter,
} from "@/lib/api/alterations";
import type {
  OrderDirection,
  TimestampFilter,
  WorkflowInstanceSummary,
  WorkflowStatus,
  WorkflowSubStatus,
} from "@/lib/api/types";

type OrderBy = NonNullable<InstancesQuery["orderBy"]>;

const PAGE_SIZE = 25;

const STATUS_VALUES = ["Running", "Finished", "Cancelled", "Faulted"] as const;
const SUBSTATUS_VALUES = [
  "Executing",
  "Suspended",
  "Finished",
  "Cancelled",
  "Faulted",
  "Pending",
] as const;
const ORDER_BY_VALUES = ["Created", "UpdatedAt", "Finished", "Name"] as const;

function parseEnumParam(
  raw: string | null,
  values: readonly string[],
): string | undefined {
  if (raw == null) return undefined;
  return values.includes(raw) ? raw : undefined;
}

const VALID_TS_COLUMNS: ReadonlySet<TimestampFilter["column"]> = new Set([
  "CreatedAt",
  "UpdatedAt",
  "FinishedAt",
]);
const VALID_TS_OPERATORS: ReadonlySet<TimestampFilter["operator"]> = new Set([
  "Is",
  "IsNot",
  "LessThan",
  "GreaterThan",
  "LessThanOrEqual",
  "GreaterThanOrEqual",
]);

/**
 * Encode the timestamp-filter array as a base64-encoded JSON blob suitable for
 * a single URL query param. Matches the Blazor app's `ts` param so links
 * remain compatible across the two studios. Returns `null` when the encoding
 * fails (we then drop the param rather than putting garbage in the URL).
 */
function encodeTimestampFilters(filters: TimestampFilter[]): string | null {
  try {
    const json = JSON.stringify(filters);
    if (typeof window === "undefined") return null;
    return window.btoa(unescape(encodeURIComponent(json)));
  } catch {
    return null;
  }
}

/** Inverse of `encodeTimestampFilters`. Discards filters that fail validation. */
function decodeTimestampFilters(raw: string | null): TimestampFilter[] {
  if (!raw || typeof window === "undefined") return [];
  try {
    const json = decodeURIComponent(escape(window.atob(raw)));
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (f): f is TimestampFilter =>
        typeof f === "object" &&
        f !== null &&
        VALID_TS_COLUMNS.has((f as TimestampFilter).column) &&
        VALID_TS_OPERATORS.has((f as TimestampFilter).operator) &&
        typeof (f as TimestampFilter).timestamp === "string",
    );
  } catch {
    return [];
  }
}

const STATUS_OPTIONS: { value: WorkflowStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "Running", label: "Running" },
  { value: "Finished", label: "Finished" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Faulted", label: "Faulted" },
];

const SUBSTATUS_OPTIONS: { value: WorkflowSubStatus | "all"; label: string }[] = [
  { value: "all", label: "Any" },
  { value: "Executing", label: "Executing" },
  { value: "Suspended", label: "Suspended" },
  { value: "Finished", label: "Finished" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Faulted", label: "Faulted" },
  { value: "Pending", label: "Pending" },
];

const INCIDENTS_OPTIONS: { value: "any" | "yes" | "no"; label: string }[] = [
  { value: "any", label: "Any incidents" },
  { value: "yes", label: "Has incidents" },
  { value: "no", label: "No incidents" },
];

/** `value → label` maps so `<SelectValue />` renders the friendly label. */
const STATUS_ITEMS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const SUBSTATUS_ITEMS: Record<string, string> = Object.fromEntries(
  SUBSTATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const INCIDENTS_ITEMS: Record<string, string> = Object.fromEntries(
  INCIDENTS_OPTIONS.map((o) => [o.value, o.label]),
);

type Confirm =
  | { kind: "cancel"; instance: WorkflowInstanceSummary }
  | { kind: "delete"; instance: WorkflowInstanceSummary }
  | { kind: "bulk-cancel"; ids: string[]; total: number }
  | { kind: "bulk-delete"; ids: string[]; total: number }
  | null;

/** Choice surfaced inside the bulk confirm dialog. */
type BulkScope = "selected" | "all";

export function InstancesTable() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Capture the initial URL params once for state-seeding. The table is the
  // source of truth after mount, and a useEffect below mirrors every state
  // change back into the URL. This makes reload / bookmark / share work
  // without forcing every setter through the router (no flicker on each
  // keystroke).
  const initialParams = useMemo(
    () => searchParams,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [status, setStatus] = useState<WorkflowStatus | "all">(
    () => (parseEnumParam(initialParams.get("status"), STATUS_VALUES) as WorkflowStatus) ?? "all",
  );
  const [subStatus, setSubStatus] = useState<WorkflowSubStatus | "all">(
    () => (parseEnumParam(initialParams.get("subStatus"), SUBSTATUS_VALUES) as WorkflowSubStatus) ?? "all",
  );
  const [incidents, setIncidents] = useState<"any" | "yes" | "no">(
    () => (parseEnumParam(initialParams.get("incidents"), ["yes", "no"]) as "yes" | "no") ?? "any",
  );
  const [search, setSearch] = useState(() => initialParams.get("q") ?? "");
  const [definitionIds, setDefinitionIds] = useState<string[]>(
    () => initialParams.getAll("def"),
  );
  const [timestampFilters, setTimestampFilters] = useState<TimestampFilter[]>(
    () => decodeTimestampFilters(initialParams.get("ts")),
  );
  const [page, setPage] = useState(() => {
    const raw = Number.parseInt(initialParams.get("page") ?? "0", 10);
    return Number.isFinite(raw) && raw >= 0 ? raw : 0;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm>(null);
  /** Defaults to the user-facing selection. Switches to "all" when the dialog's
   * "apply to all matching" toggle is chosen and a bulk confirm is open. */
  const [bulkScope, setBulkScope] = useState<BulkScope>("selected");
  // Auto-refresh cadence shared with the viewer; persists in localStorage so
  // the choice sticks across page loads.
  const { ms: pollingMs, setMs: setPollingMs } = usePollingInterval();
  // Sort: defaults to newest-created first. Click cycles Desc → Asc → reset to
  // the default ("Created" / "Descending"). The Elsa server only sorts on this
  // closed enum, so non-listed columns (Sub-status, Incidents, Correlation)
  // are intentionally not click-sortable.
  const [orderBy, setOrderBy] = useState<OrderBy>(
    () => (parseEnumParam(initialParams.get("orderBy"), ORDER_BY_VALUES) as OrderBy) ?? "Created",
  );
  const [orderDirection, setOrderDirection] = useState<OrderDirection>(
    () =>
      initialParams.get("orderDir") === "Ascending" ? "Ascending" : "Descending",
  );

  const debouncedSearch = useDebouncedValue(search, 250);

  // Mirror filters into the URL so reload / bookmark / share keep them.
  // We use the *debounced* search so each keystroke doesn't churn the URL.
  useEffect(() => {
    const sp = new URLSearchParams();
    if (status !== "all") sp.set("status", status);
    if (subStatus !== "all") sp.set("subStatus", subStatus);
    if (incidents !== "any") sp.set("incidents", incidents);
    if (debouncedSearch) sp.set("q", debouncedSearch);
    for (const id of definitionIds) sp.append("def", id);
    if (timestampFilters.length > 0) {
      const encoded = encodeTimestampFilters(timestampFilters);
      if (encoded) sp.set("ts", encoded);
    }
    if (orderBy !== "Created") sp.set("orderBy", orderBy);
    if (orderDirection !== "Descending") sp.set("orderDir", orderDirection);
    if (page > 0) sp.set("page", String(page));
    const qs = sp.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    // Compare against current to avoid a no-op replace (which Next 16 logs).
    const current = `${pathname}${
      searchParams.toString() ? `?${searchParams.toString()}` : ""
    }`;
    if (target !== current) {
      router.replace(target, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    subStatus,
    incidents,
    debouncedSearch,
    definitionIds,
    timestampFilters,
    orderBy,
    orderDirection,
    page,
    pathname,
  ]);

  const q = useWorkflowInstances(
    {
      page,
      pageSize: PAGE_SIZE,
      status: status === "all" ? undefined : status,
      subStatus: subStatus === "all" ? undefined : subStatus,
      hasIncidents:
        incidents === "yes" ? true : incidents === "no" ? false : undefined,
      searchTerm: debouncedSearch || undefined,
      definitionIds: definitionIds.length > 0 ? definitionIds : undefined,
      timestampFilters: timestampFilters.length > 0 ? timestampFilters : undefined,
      orderBy,
      orderDirection,
    },
    { refetchInterval: pollingMs > 0 ? pollingMs : undefined },
  );

  // Power the multi-select with up to 200 latest-or-published definitions —
  // matches the cap Blazor uses for the same picker. Users with more should
  // search by name/id.
  const definitionsForPicker = useWorkflowDefinitions({
    versionOptions: "LatestOrPublished",
    pageSize: 200,
    orderBy: "Name",
    orderDirection: "Ascending",
  });

  const cycleSort = (column: OrderBy) => {
    setPage(0);
    if (orderBy !== column) {
      setOrderBy(column);
      setOrderDirection("Descending");
      return;
    }
    if (orderDirection === "Descending") {
      setOrderDirection("Ascending");
      return;
    }
    // Third click on the same column: reset to the default sort.
    setOrderBy("Created");
    setOrderDirection("Descending");
  };

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const total = q.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + items.length;

  const cancelOne = useCancelInstance();
  const deleteOne = useDeleteInstance();
  const bulkCancel = useBulkCancelInstances();
  const bulkDelete = useBulkDeleteInstances();
  const bulkExport = useBulkExportInstances();
  const exportOne = useExportInstance();
  const submitAlterations = useSubmitAlterations();

  // Refresh hotkey (⌘/Ctrl + R) — preventDefault so the browser doesn't reload
  // the whole page. Suppressed while focus is in an input so search/filter
  // typing still works as expected.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "r") return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) {
        return;
      }
      e.preventDefault();
      q.refetch();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q]);

  /**
   * Materialise the live list filter as an `AlterationWorkflowInstanceFilter`
   * payload. The server's filter type accepts the same column shape; we pass
   * `emptyFilterSelectsAll: true` so an unfiltered list cancels everything
   * (matches Blazor's behaviour).
   */
  const currentFilterForAlteration = useMemo(() => ({
    emptyFilterSelectsAll: true,
    searchTerm: debouncedSearch || undefined,
    statuses: status === "all" ? undefined : [status],
    subStatuses: subStatus === "all" ? undefined : [subStatus],
    hasIncidents:
      incidents === "yes" ? true : incidents === "no" ? false : undefined,
    definitionIds: definitionIds.length > 0 ? definitionIds : undefined,
    timestampFilters:
      timestampFilters.length > 0 ? timestampFilters : undefined,
    isSystem: false,
  }), [
    debouncedSearch,
    status,
    subStatus,
    incidents,
    definitionIds,
    timestampFilters,
  ]);

  const idsOnPage = items.map((i) => i.id);
  const allOnPageSelected =
    idsOnPage.length > 0 && idsOnPage.every((id) => selected.has(id));
  const someOnPageSelected =
    idsOnPage.some((id) => selected.has(id)) && !allOnPageSelected;

  const togglePage = (checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) idsOnPage.forEach((id) => next.add(id));
      else idsOnPage.forEach((id) => next.delete(id));
      return next;
    });

  const toggleOne = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const onConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === "cancel") {
        await cancelOne.mutateAsync(confirm.instance.id);
        toast.success("Instance cancelled.");
      } else if (confirm.kind === "delete") {
        await deleteOne.mutateAsync(confirm.instance.id);
        toast.success("Instance deleted.");
      } else if (confirm.kind === "bulk-cancel") {
        if (bulkScope === "all") {
          // The bulk-cancel endpoint accepts ids or definitionId only — for an
          // arbitrary filter we route through the Alterations API, which
          // mirrors Blazor's "apply to all matches" path.
          await submitAlterations.mutateAsync({
            alterations: [{ type: "Cancel" }],
            filter: currentFilterForAlteration,
          });
          toast.success("Cancelling everything that matches…");
        } else {
          await bulkCancel.mutateAsync(confirm.ids);
          toast.success(`Cancelled ${confirm.ids.length} instances.`);
        }
        clearSelection();
      } else if (confirm.kind === "bulk-delete") {
        if (bulkScope === "all") {
          // Server's bulk delete only takes ids or definitionId — for a full
          // filter we page through the matching ids ourselves (capped at the
          // safety ceiling). Less elegant than the Alteration route, but
          // there's no `Delete` alteration on the server side.
          const ids = await collectAllMatchingIds(currentFilterForAlteration);
          if (ids.length === 0) {
            toast.info("Nothing matched the current filter.");
          } else {
            await bulkDelete.mutateAsync(ids);
            toast.success(`Deleted ${ids.length} instances.`);
          }
        } else {
          await bulkDelete.mutateAsync(confirm.ids);
          toast.success(`Deleted ${confirm.ids.length} instances.`);
        }
        clearSelection();
      }
      setConfirm(null);
      setBulkScope("selected");
    } catch {
      toast.error("Couldn't apply that action.");
    }
  };

  const confirmBusy =
    cancelOne.isPending ||
    deleteOne.isPending ||
    bulkCancel.isPending ||
    bulkDelete.isPending ||
    submitAlterations.isPending;

  const isBulkConfirm =
    confirm?.kind === "bulk-cancel" || confirm?.kind === "bulk-delete";
  const bulkTotal = isBulkConfirm ? confirm!.total : 0;
  const bulkSelectedCount = isBulkConfirm ? confirm!.ids.length : 0;
  const bulkAction = confirm?.kind === "bulk-delete" ? "Delete" : "Cancel";
  const effectiveCount =
    bulkScope === "all" ? bulkTotal : bulkSelectedCount;

  const confirmCopy = (() => {
    if (!confirm) return null;
    switch (confirm.kind) {
      case "cancel":
        return {
          title: "Cancel instance?",
          description:
            "The instance will stop executing. Its state is preserved for inspection.",
          confirmLabel: "Cancel instance",
        };
      case "delete":
        return {
          title: "Delete instance?",
          description: "All execution data for this instance will be removed permanently.",
          confirmLabel: "Delete",
          variant: "destructive" as const,
        };
      case "bulk-cancel":
        return {
          title: `Cancel ${effectiveCount} instances?`,
          description: bulkScopeDescription(
            "cancel",
            bulkScope,
            bulkTotal,
            bulkSelectedCount,
            setBulkScope,
          ),
          confirmLabel: "Cancel instances",
        };
      case "bulk-delete":
        return {
          title: `Delete ${effectiveCount} instances?`,
          description: bulkScopeDescription(
            "delete",
            bulkScope,
            bulkTotal,
            bulkSelectedCount,
            setBulkScope,
          ),
          confirmLabel: "Delete",
          variant: "destructive" as const,
        };
    }
    // Exhaustiveness for the eslint plugin.
    void bulkAction;
    return null;
  })();

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
            placeholder="Search by id, correlation or name…"
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

        <Select
          items={STATUS_ITEMS}
          value={status}
          onValueChange={(v) => {
            setStatus(v as WorkflowStatus | "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-44" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={SUBSTATUS_ITEMS}
          value={subStatus}
          onValueChange={(v) => {
            setSubStatus(v as WorkflowSubStatus | "all");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUBSTATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          items={INCIDENTS_ITEMS}
          value={incidents}
          onValueChange={(v) => {
            setIncidents(v as "any" | "yes" | "no");
            setPage(0);
          }}
        >
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INCIDENTS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DefinitionsFilter
          value={definitionIds}
          definitions={definitionsForPicker.data?.items ?? []}
          isLoading={definitionsForPicker.isPending}
          onChange={(ids) => {
            setDefinitionIds(ids);
            setPage(0);
          }}
        />

        <TimeRangeFilter
          value={timestampFilters}
          onChange={(next) => {
            setTimestampFilters(next);
            setPage(0);
          }}
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {q.isFetching ? "Refreshing…" : total > 0 ? `${first}–${last} of ${total}` : "No results"}
          </span>
          <ImportInstancesButton />
          <PollingIntervalPicker
            value={pollingMs}
            onChange={setPollingMs}
            onRefreshNow={() => q.refetch()}
            busy={q.isFetching}
          />
        </div>
      </FilterToolbar>

      {selected.size > 0 ? (
        <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-xs ring-1 ring-black/[0.02] dark:ring-white/5">
          <span className="text-sm font-medium tabular-nums">
            {selected.size} selected
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearSelection}
            aria-label="Clear selection"
          >
            <X className="size-3.5" />
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkExport.isPending}
              onClick={async () => {
                try {
                  await bulkExport.mutateAsync({ ids: Array.from(selected) });
                } catch {
                  toast.error("Couldn't export the selected instances.");
                }
              }}
            >
              <Download className="size-3.5" /> Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkCancel.isPending}
              onClick={() => {
                setBulkScope("selected");
                setConfirm({
                  kind: "bulk-cancel",
                  ids: Array.from(selected),
                  total,
                });
              }}
            >
              <XCircle className="size-3.5" /> Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkDelete.isPending}
              onClick={() => {
                setBulkScope("selected");
                setConfirm({
                  kind: "bulk-delete",
                  ids: Array.from(selected),
                  total,
                });
              }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </div>
        </div>
      ) : null}

      <div className="bg-card overflow-hidden rounded-xl border shadow-xs ring-1 ring-black/[0.02] dark:ring-white/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 pl-3">
                <Checkbox
                  aria-label="Select all on this page"
                  checked={allOnPageSelected}
                  indeterminate={someOnPageSelected || undefined}
                  onCheckedChange={(c) => togglePage(c)}
                  disabled={idsOnPage.length === 0}
                />
              </TableHead>
              <TableHead className="w-[28%]">
                <SortableHeader
                  label="Instance"
                  column="Name"
                  orderBy={orderBy}
                  orderDirection={orderDirection}
                  onClick={cycleSort}
                />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sub-status</TableHead>
              <TableHead className="hidden lg:table-cell">Correlation</TableHead>
              <TableHead>Incidents</TableHead>
              <TableHead>
                <SortableHeader
                  label="Created"
                  column="Created"
                  orderBy={orderBy}
                  orderDirection={orderDirection}
                  onClick={cycleSort}
                />
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <SortableHeader
                  label="Updated"
                  column="UpdatedAt"
                  orderBy={orderBy}
                  orderDirection={orderDirection}
                  onClick={cycleSort}
                />
              </TableHead>
              <TableHead className="hidden md:table-cell">
                <SortableHeader
                  label="Finished"
                  column="Finished"
                  orderBy={orderBy}
                  orderDirection={orderDirection}
                  onClick={cycleSort}
                />
              </TableHead>
              <TableHead className="w-8 pr-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isPending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : q.isError ? (
              <TableRow>
                <TableCell colSpan={10} className="text-destructive py-8 text-center text-sm">
                  Couldn&apos;t load workflow instances.
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <ListEmptyState
                    icon={Activity}
                    title="No instances"
                    description="No workflow instances match the current filters. Adjust the filters or start a workflow to see runs here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((i) => {
                const checked = selected.has(i.id);
                return (
                  <TableRow
                    key={i.id}
                    className="group"
                    data-state={checked ? "selected" : undefined}
                  >
                    <TableCell className="pl-3">
                      <Checkbox
                        aria-label={`Select ${i.id}`}
                        checked={checked}
                        onCheckedChange={(c) => toggleOne(i.id, c)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/workflows/instances/${i.id}`}
                        className="hover:text-primary block max-w-md truncate transition-colors"
                        title={i.id}
                      >
                        {i.name?.trim() || (
                          <span className="text-muted-foreground font-mono text-xs">
                            {i.id.slice(0, 8)}
                          </span>
                        )}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">
                        def {i.definitionId.slice(0, 8)} · v{i.version ?? "?"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={i.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {i.subStatus}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden whitespace-nowrap text-xs lg:table-cell">
                      {i.correlationId ? (
                        <span className="font-mono" title={i.correlationId}>
                          {i.correlationId.slice(0, 8)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <IncidentsBadge count={i.incidentCount ?? 0} />
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {formatDistanceToNow(new Date(i.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden whitespace-nowrap text-xs md:table-cell">
                      {formatDistanceToNow(new Date(i.updatedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden whitespace-nowrap text-xs md:table-cell">
                      {i.finishedAt
                        ? formatDistanceToNow(new Date(i.finishedAt), { addSuffix: true })
                        : "—"}
                    </TableCell>
                    <TableCell className="pr-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${i.name?.trim() || i.id.slice(0, 8)}`}
                            />
                          }
                        >
                          <MoreVertical className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            render={<Link href={`/workflows/instances/${i.id}`} />}
                          >
                            <Eye className="size-3.5" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={async () => {
                              try {
                                await exportOne.mutateAsync({ instanceId: i.id });
                              } catch {
                                toast.error("Couldn't export this instance.");
                              }
                            }}
                          >
                            <Download className="size-3.5" /> Export JSON
                          </DropdownMenuItem>
                          {i.status === "Running" ? (
                            <DropdownMenuItem
                              onSelect={() =>
                                setConfirm({ kind: "cancel", instance: i })
                              }
                            >
                              <XCircle className="size-3.5" /> Cancel
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() =>
                              setConfirm({ kind: "delete", instance: i })
                            }
                            variant="destructive"
                          >
                            <Trash2 className="size-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
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

      {confirm && confirmCopy ? (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={confirmCopy.title}
          description={confirmCopy.description}
          confirmLabel={confirmCopy.confirmLabel}
          variant={confirmCopy.variant}
          busy={confirmBusy}
          onConfirm={onConfirm}
        />
      ) : null}
    </div>
  );
}

type DefinitionLite = {
  definitionId: string;
  name?: string | null;
};

function DefinitionsFilter({
  value,
  definitions,
  isLoading,
  onChange,
}: {
  value: string[];
  definitions: DefinitionLite[];
  isLoading: boolean;
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return definitions;
    return definitions.filter((d) =>
      (d.name ?? d.definitionId).toLowerCase().includes(q) ||
      d.definitionId.toLowerCase().includes(q),
    );
  }, [definitions, query]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of definitions) m.set(d.definitionId, d.name?.trim() || d.definitionId.slice(0, 8));
    return m;
  }, [definitions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={[
          "border-input bg-background flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),10px)] border px-2 text-xs",
          "focus-visible:ring-ring/50 focus-visible:ring-2 outline-none",
        ].join(" ")}
      >
        <FileBox className="text-muted-foreground size-3.5 shrink-0" />
        <span className="text-muted-foreground">
          {selected.size === 0
            ? "Any definition"
            : selected.size === 1
              ? nameById.get([...selected][0]) ?? "1 definition"
              : `${selected.size} definitions`}
        </span>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-72 p-0">
        <div className="flex items-center gap-1 border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter definitions…"
            className="h-7 text-xs"
          />
          {selected.size > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onChange([])}
              title="Clear all"
            >
              Clear
            </Button>
          ) : null}
        </div>
        <div className="max-h-60 overflow-y-auto py-1">
          {isLoading ? (
            <p className="text-muted-foreground px-3 py-2 text-xs">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-xs">No definitions.</p>
          ) : (
            filtered.map((d) => (
              <label
                key={d.definitionId}
                className="hover:bg-muted/60 flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs"
              >
                <Checkbox
                  checked={selected.has(d.definitionId)}
                  onCheckedChange={() => toggle(d.definitionId)}
                />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate">{d.name?.trim() || "(unnamed)"}</span>
                  <span className="text-muted-foreground truncate font-mono text-2xs">
                    {d.definitionId.slice(0, 8)}
                  </span>
                </div>
              </label>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortableHeader({
  label,
  column,
  orderBy,
  orderDirection,
  onClick,
}: {
  label: string;
  column: OrderBy;
  orderBy: OrderBy;
  orderDirection: OrderDirection;
  onClick: (column: OrderBy) => void;
}) {
  const active = orderBy === column;
  const Icon = !active
    ? ArrowUpDown
    : orderDirection === "Descending"
      ? ArrowDown
      : ArrowUp;
  return (
    <button
      type="button"
      onClick={() => onClick(column)}
      className={[
        "group/sort -mx-1 -my-0.5 inline-flex items-center gap-1 rounded px-1 py-0.5",
        "hover:bg-muted/60 focus-visible:bg-muted/60 outline-none",
        active ? "text-foreground" : "",
      ].join(" ")}
      aria-label={`Sort by ${label}${
        active
          ? orderDirection === "Ascending"
            ? " (ascending)"
            : " (descending)"
          : ""
      }`}
    >
      <span>{label}</span>
      <Icon
        className={[
          "size-3 shrink-0",
          active ? "opacity-100" : "opacity-30 group-hover/sort:opacity-70",
        ].join(" ")}
      />
    </button>
  );
}

function IncidentsBadge({ count }: { count: number }) {
  if (count <= 0) {
    return <span className="text-muted-foreground/60 text-xs tabular-nums">0</span>;
  }
  return (
    <Badge className="border-rose-600 bg-rose-500/15 text-rose-700 dark:text-rose-200 tabular-nums" variant="outline">
      {count}
    </Badge>
  );
}

function StatusBadge({ status }: { status: WorkflowStatus }) {
  // Tinted outline badges in the same family as the definitions list's
  // "Published" / "Draft" pills — calmer than solid fills, still
  // colour-differentiated at a glance.
  const base = "font-normal";
  if (status === "Running") {
    return (
      <Badge
        variant="outline"
        className={`${base} border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300`}
      >
        Running
      </Badge>
    );
  }
  if (status === "Finished") {
    return (
      <Badge
        variant="outline"
        className={`${base} border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300`}
      >
        Finished
      </Badge>
    );
  }
  if (status === "Faulted") {
    return (
      <Badge
        variant="outline"
        className={`${base} border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300`}
      >
        Faulted
      </Badge>
    );
  }
  if (status === "Cancelled") {
    return (
      <Badge
        variant="outline"
        className={`${base} border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300`}
      >
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={base}>
      {status}
    </Badge>
  );
}

/**
 * Inline scope-toggle rendered as the bulk confirm dialog's description. Lets
 * the operator pick between cancelling/deleting only the rows they ticked, or
 * everything that matches the current filter (mirrors Blazor's
 * `BulkCancelDialog`).
 */
function bulkScopeDescription(
  verb: "cancel" | "delete",
  scope: BulkScope,
  total: number,
  selectedCount: number,
  setScope: (s: BulkScope) => void,
) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-xs">
        Choose what this {verb} applies to:
      </p>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="radio"
          name="bulk-scope"
          checked={scope === "selected"}
          onChange={() => setScope("selected")}
          className="mt-0.5"
        />
        <span>
          The {selectedCount} selected row{selectedCount === 1 ? "" : "s"}.
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="radio"
          name="bulk-scope"
          checked={scope === "all"}
          onChange={() => setScope("all")}
          className="mt-0.5"
        />
        <span>
          Every instance matching the current filter ({total.toLocaleString()}{" "}
          total).
        </span>
      </label>
    </div>
  );
}

/**
 * Page through `useWorkflowInstances` for every match of the supplied filter
 * shape and return the flat list of ids. Used by the "delete all matches"
 * path, which the server's bulk-delete endpoint can't satisfy directly (it
 * only accepts ids or a definitionId). Cap at 5,000 so a runaway filter
 * doesn't melt the page — the user can re-run if more remain.
 */
async function collectAllMatchingIds(
  filter: AlterationWorkflowInstanceFilter,
): Promise<string[]> {
  const MAX_IDS = 5000;
  const PAGE_SIZE = 250;
  const ids: string[] = [];
  let page = 0;
  // Translate the alteration-filter shape into the `InstancesQuery` shape the
  // list endpoint accepts. Field names match save for status/sub-status
  // being singular here (the list endpoint takes one of each).
  const buildQuery = (p: number): InstancesQuery => ({
    page: p,
    pageSize: PAGE_SIZE,
    status: filter.statuses?.[0],
    subStatus: filter.subStatuses?.[0],
    hasIncidents: filter.hasIncidents,
    searchTerm: filter.searchTerm,
    definitionIds: filter.definitionIds,
    timestampFilters: filter.timestampFilters,
  });
  // Loop until we exhaust the matching set or hit the safety ceiling.
  // We use the same React Query fetcher via dynamic import to keep one source
  // of truth for the request shape; falling back to a hand-rolled fetch
  // would risk drifting from the hook's serialisation rules.
  while (ids.length < MAX_IDS) {
    const { elsa } = await import("@/lib/api/client");
    const params = buildQuery(page);
    const hasTimestamps = (params.timestampFilters?.length ?? 0) > 0;
    const res = hasTimestamps
      ? await elsa
          .post("workflow-instances", { json: params })
          .json<{ items: { id: string }[]; totalCount: number }>()
      : await elsa
          .get("workflow-instances", { searchParams: buildIdsSearchParams(params) })
          .json<{ items: { id: string }[]; totalCount: number }>();
    for (const it of res.items) ids.push(it.id);
    if (res.items.length < PAGE_SIZE) break;
    page++;
  }
  return ids;
}

function buildIdsSearchParams(input: Record<string, unknown>): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) for (const item of v) sp.append(k, String(item));
    else sp.set(k, String(v));
  }
  return sp;
}
