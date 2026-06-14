"use client";

import { format } from "date-fns";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FileBox,
  FileText,
  Plus,
  RefreshCw,
  Search,
  Tag,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import { useSession } from "@/features/auth/use-session";
import { BulkActionsBar } from "@/features/workflows/bulk-actions-bar";
import { CloneDefinitionDialog } from "@/features/workflows/clone-definition-dialog";
import { ConfirmDialog } from "@/features/workflows/confirm-dialog";
import { CreateDefinitionDialog } from "@/features/workflows/create-definition-dialog";
import {
  DefinitionRowMenu,
  type DefinitionRowAction,
} from "@/features/workflows/definition-row-menu";
import { ExportDefinitionDialog } from "@/features/workflows/export-definition-dialog";
import { ImportDefinitionsButton } from "@/features/workflows/import-definitions-button";
import { MarkdownViewerDialog } from "@/features/workflows/markdown-viewer-dialog";
import {
  FilterToolbar,
  ListEmptyState,
  ListPagination,
} from "@/features/workflows/list-page-shell";
import { useDebouncedValue } from "@/features/workflows/use-debounced";
import {
  useBulkDeleteDefinitions,
  useBulkPublishDefinitions,
  useBulkRetractDefinitions,
  useCancelInstancesByDefinition,
  useDeleteDefinition,
  useExecuteDefinition,
  useLabels,
  usePublishDefinition,
  useRetractDefinition,
  useWorkflowDefinitions,
} from "@/lib/api/elsa";
import type {
  OrderByWorkflowDefinition,
  OrderDirection,
  VersionOptions,
  WorkflowDefinitionSummary,
} from "@/lib/api/types";

const PAGE_SIZE = 20;

const VERSION_FILTERS: { value: VersionOptions; label: string }[] = [
  { value: "LatestOrPublished", label: "Latest or published" },
  { value: "Published", label: "Published only" },
  { value: "Latest", label: "Latest (any state)" },
  { value: "Draft", label: "Drafts only" },
];

/** `value → label` map so `<SelectValue />` renders the friendly label. */
const VERSION_FILTER_ITEMS: Record<string, string> = Object.fromEntries(
  VERSION_FILTERS.map((f) => [f.value as string, f.label]),
);

type ConfirmKind =
  | "delete"
  | "bulk-delete"
  | "publish"
  | "retract"
  | "bulk-publish"
  | "bulk-retract"
  | "cancel-instances";

type ConfirmState =
  | { kind: "delete"; definition: WorkflowDefinitionSummary }
  | { kind: "publish"; definition: WorkflowDefinitionSummary }
  | { kind: "retract"; definition: WorkflowDefinitionSummary }
  | { kind: "cancel-instances"; definition: WorkflowDefinitionSummary }
  | { kind: "bulk-delete"; ids: string[] }
  | { kind: "bulk-publish"; ids: string[] }
  | { kind: "bulk-retract"; ids: string[] }
  | null;

export function DefinitionsTable() {
  const router = useRouter();
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [versionOptions, setVersionOptions] = useState<VersionOptions>("LatestOrPublished");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [orderBy, setOrderBy] = useState<OrderByWorkflowDefinition>("Name");
  const [orderDirection, setOrderDirection] = useState<OrderDirection>("Ascending");
  const [descriptionView, setDescriptionView] =
    useState<WorkflowDefinitionSummary | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [materializer, setMaterializer] = useState<string>("");

  const debouncedSearch = useDebouncedValue(search, 250);
  const debouncedMaterializer = useDebouncedValue(materializer, 250);
  const labels = useLabels();

  const q = useWorkflowDefinitions({
    page,
    pageSize: PAGE_SIZE,
    searchTerm: debouncedSearch || undefined,
    versionOptions,
    orderBy,
    orderDirection,
    labels: selectedLabels.length > 0 ? selectedLabels : undefined,
    materializer: debouncedMaterializer.trim() || undefined,
  });

  const toggleLabel = (id: string) => {
    setSelectedLabels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setPage(0);
  };

  /** Click a column header to toggle sort. */
  const onSort = (col: OrderByWorkflowDefinition) => {
    if (orderBy === col) {
      setOrderDirection((d) => (d === "Ascending" ? "Descending" : "Ascending"));
    } else {
      setOrderBy(col);
      setOrderDirection("Ascending");
    }
    setPage(0);
  };

  const items = useMemo(() => q.data?.items ?? [], [q.data]);
  const total = q.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showing = items.length;
  const first = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const last = page * PAGE_SIZE + showing;

  // Mutations
  const deleteOne = useDeleteDefinition();
  const publishOne = usePublishDefinition();
  const retractOne = useRetractDefinition();
  const bulkDelete = useBulkDeleteDefinitions();
  const bulkPublish = useBulkPublishDefinitions();
  const bulkRetract = useBulkRetractDefinitions();
  const cancelInstances = useCancelInstancesByDefinition();
  const execute = useExecuteDefinition();

  // Dialog state
  const [showCreate, setShowCreate] = useState(false);
  const [clone, setClone] = useState<WorkflowDefinitionSummary | null>(null);
  const [exportTarget, setExportTarget] = useState<
    | { mode: "single"; definition: WorkflowDefinitionSummary }
    | { mode: "bulk"; ids: string[] }
    | null
  >(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const idsOnPage = items.map((i) => i.definitionId);
  const allOnPageSelected =
    idsOnPage.length > 0 && idsOnPage.every((id) => selected.has(id));
  const someOnPageSelected =
    idsOnPage.some((id) => selected.has(id)) && !allOnPageSelected;

  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) idsOnPage.forEach((id) => next.add(id));
      else idsOnPage.forEach((id) => next.delete(id));
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const onRowAction = async (action: DefinitionRowAction, d: WorkflowDefinitionSummary) => {
    switch (action) {
      case "duplicate":
        setClone(d);
        break;
      case "export":
        setExportTarget({ mode: "single", definition: d });
        break;
      case "delete":
        setConfirm({ kind: "delete", definition: d });
        break;
      case "publish":
        setConfirm({ kind: "publish", definition: d });
        break;
      case "retract":
        setConfirm({ kind: "retract", definition: d });
        break;
      case "cancel-instances":
        setConfirm({ kind: "cancel-instances", definition: d });
        break;
      case "run": {
        try {
          const res = await execute.mutateAsync({ definitionId: d.definitionId });
          if (res.cannotStart) {
            toast.error("Workflow can't start (no published version or missing trigger).");
          } else if (res.workflowInstanceId) {
            toast.success("Workflow started.", {
              action: {
                label: "View",
                onClick: () => router.push(`/workflows/instances`),
              },
            });
          } else {
            toast.success("Workflow started.");
          }
        } catch {
          toast.error("Couldn't start the workflow.");
        }
        break;
      }
      case "open":
        router.push(`/workflows/definitions/${d.definitionId}/edit`);
        break;
    }
  };

  const onConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.kind === "delete") {
        await deleteOne.mutateAsync(confirm.definition.definitionId);
        toast.success("Workflow deleted.");
      } else if (confirm.kind === "publish") {
        await publishOne.mutateAsync(confirm.definition.definitionId);
        toast.success("Workflow published.");
      } else if (confirm.kind === "retract") {
        await retractOne.mutateAsync(confirm.definition.definitionId);
        toast.success("Workflow unpublished.");
      } else if (confirm.kind === "cancel-instances") {
        const res = await cancelInstances.mutateAsync({
          definitionId: confirm.definition.definitionId,
        });
        toast.success(
          res.cancelled
            ? `Cancelled ${res.cancelled} running instance${res.cancelled === 1 ? "" : "s"}.`
            : "No running instances to cancel.",
        );
      } else if (confirm.kind === "bulk-delete") {
        const res = await bulkDelete.mutateAsync(confirm.ids);
        toast.success(`Deleted ${res.deleted} workflows.`);
        clearSelection();
      } else if (confirm.kind === "bulk-publish") {
        const res = await bulkPublish.mutateAsync(confirm.ids);
        toast.success(
          `Published ${res.published.length}` +
            (res.alreadyPublished.length
              ? ` (${res.alreadyPublished.length} already published)`
              : ""),
        );
        clearSelection();
      } else if (confirm.kind === "bulk-retract") {
        const res = await bulkRetract.mutateAsync(confirm.ids);
        toast.success(
          `Unpublished ${res.retracted.length}` +
            (res.alreadyRetracted.length
              ? ` (${res.alreadyRetracted.length} were already drafts)`
              : ""),
        );
        clearSelection();
      }
      setConfirm(null);
    } catch {
      toast.error("That didn't work — please try again.");
    }
  };

  const confirmBusy = (() => {
    switch (confirm?.kind) {
      case "delete":
        return deleteOne.isPending;
      case "publish":
        return publishOne.isPending;
      case "retract":
        return retractOne.isPending;
      case "cancel-instances":
        return cancelInstances.isPending;
      case "bulk-delete":
        return bulkDelete.isPending;
      case "bulk-publish":
        return bulkPublish.isPending;
      case "bulk-retract":
        return bulkRetract.isPending;
      default:
        return false;
    }
  })();

  const confirmCopy = (() => {
    if (!confirm) return null;
    switch (confirm.kind) {
      case "delete":
        return {
          title: "Delete workflow?",
          description: (
            <>
              <strong>{confirm.definition.name}</strong> and all of its versions will be
              permanently removed. Running instances will keep their snapshot.
            </>
          ),
          confirmLabel: "Delete",
          variant: "destructive" as const,
        };
      case "publish":
        return {
          title: "Publish workflow?",
          description: (
            <>Make <strong>{confirm.definition.name}</strong> the live version that triggers fire against.</>
          ),
          confirmLabel: "Publish",
        };
      case "retract":
        return {
          title: "Unpublish workflow?",
          description: (
            <>
              <strong>{confirm.definition.name}</strong> will stop responding to triggers
              until you publish a version again.
            </>
          ),
          confirmLabel: "Unpublish",
        };
      case "cancel-instances":
        return {
          title: "Cancel running instances?",
          description: (
            <>
              All running instances of <strong>{confirm.definition.name}</strong>{" "}
              (every version) will be cancelled. Their state is preserved for inspection.
            </>
          ),
          confirmLabel: "Cancel instances",
        };
      case "bulk-delete":
        return {
          title: `Delete ${confirm.ids.length} workflows?`,
          description:
            "All selected workflows and every version of them will be permanently removed.",
          confirmLabel: "Delete",
          variant: "destructive" as const,
        };
      case "bulk-publish":
        return {
          title: `Publish ${confirm.ids.length} workflows?`,
          confirmLabel: "Publish",
        };
      case "bulk-retract":
        return {
          title: `Unpublish ${confirm.ids.length} workflows?`,
          confirmLabel: "Unpublish",
        };
    }
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
            placeholder="Search by name, ID or description…"
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
          items={VERSION_FILTER_ITEMS}
          value={versionOptions}
          onValueChange={(v) => {
            setVersionOptions(v as VersionOptions);
            setPage(0);
          }}
        >
          <SelectTrigger className="w-56" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VERSION_FILTERS.map((f) => (
              <SelectItem key={f.value as string} value={f.value as string}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={materializer}
          onChange={(e) => {
            setMaterializer(e.target.value);
            setPage(0);
          }}
          placeholder="Materializer…"
          className="h-8 w-40 text-sm"
        />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" />}
            disabled={(labels.data?.length ?? 0) === 0}
          >
            <Tag className="size-3.5" />
            {selectedLabels.length === 0
              ? "Labels"
              : `${selectedLabels.length} label${selectedLabels.length === 1 ? "" : "s"}`}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Filter by labels</DropdownMenuLabel>
            </DropdownMenuGroup>
            {(labels.data ?? []).map((l) => (
              <DropdownMenuCheckboxItem
                key={l.id}
                checked={selectedLabels.includes(l.id)}
                onCheckedChange={() => toggleLabel(l.id)}
              >
                <span
                  aria-hidden
                  className="inline-block size-2 rounded-full"
                  style={{ background: l.color ?? "var(--muted-foreground)" }}
                />
                <span>{l.name}</span>
              </DropdownMenuCheckboxItem>
            ))}
            {selectedLabels.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedLabels([]);
                  setPage(0);
                }}
                className="mt-1 w-full rounded-md px-2 py-1 text-left text-xs text-muted-foreground hover:bg-accent"
              >
                Clear selection
              </button>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

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
          >
            <RefreshCw className={`size-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
          </Button>
          <ImportDefinitionsButton />
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="size-3.5" /> New workflow
          </Button>
        </div>
      </FilterToolbar>

      <BulkActionsBar
        selectedCount={selected.size}
        onClear={clearSelection}
        onPublish={() =>
          setConfirm({ kind: "bulk-publish", ids: Array.from(selected) })
        }
        onRetract={() =>
          setConfirm({ kind: "bulk-retract", ids: Array.from(selected) })
        }
        onExport={() =>
          setExportTarget({ mode: "bulk", ids: Array.from(selected) })
        }
        onDelete={() =>
          setConfirm({ kind: "bulk-delete", ids: Array.from(selected) })
        }
        busy={
          bulkDelete.isPending ||
          bulkPublish.isPending ||
          bulkRetract.isPending
        }
      />

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
              <TableHead className="w-[34%]">
                <SortHeader
                  label="Name"
                  active={orderBy === "Name"}
                  direction={orderDirection}
                  onClick={() => onSort("Name")}
                />
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">
                <SortHeader
                  label="Version"
                  active={orderBy === "Version"}
                  direction={orderDirection}
                  onClick={() => onSort("Version")}
                  alignEnd
                />
              </TableHead>
              <TableHead>
                <SortHeader
                  label="Created"
                  active={orderBy === "Created"}
                  direction={orderDirection}
                  onClick={() => onSort("Created")}
                />
              </TableHead>
              <TableHead className="hidden md:table-cell">Materializer</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {session && q.isPending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : q.isError ? (
              <TableRow>
                <TableCell colSpan={7} className="text-destructive py-8 text-center text-sm">
                  Couldn&apos;t load workflow definitions.
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <ListEmptyState
                    icon={FileBox}
                    title={
                      debouncedSearch
                        ? "No matches"
                        : "No workflow definitions yet"
                    }
                    description={
                      debouncedSearch
                        ? `Nothing matches “${debouncedSearch}”. Try a different keyword or clear the filters.`
                        : "Create a workflow to start designing automations, or import one from a file."
                    }
                    action={
                      debouncedSearch ? null : (
                        <Button size="sm" onClick={() => setShowCreate(true)}>
                          <Plus className="size-3.5" /> New workflow
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            ) : (
              items.map((d) => {
                const checked = selected.has(d.definitionId);
                return (
                  <TableRow key={`${d.definitionId}-${d.version}`} className="group" data-state={checked ? "selected" : undefined}>
                    <TableCell className="pl-3">
                      <Checkbox
                        aria-label={`Select ${d.name}`}
                        checked={checked}
                        onCheckedChange={(c) => toggleOne(d.definitionId, c)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <Link
                        href={`/workflows/definitions/${d.definitionId}/edit`}
                        className="hover:text-primary block max-w-md truncate transition-colors"
                      >
                        {d.name || (
                          <span className="text-muted-foreground font-mono text-xs">
                            {d.definitionId.slice(0, 8)}
                          </span>
                        )}
                      </Link>
                      {d.description ? (
                        <div className="flex max-w-md items-center gap-1.5">
                          <p className="text-muted-foreground line-clamp-1 text-xs">
                            {d.description}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="View full description"
                            title="View description"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDescriptionView(d);
                            }}
                          >
                            <FileText className="size-3" />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {d.isPublished ? (
                        <Badge variant="default" className="font-normal">
                          Published
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          Draft
                        </Badge>
                      )}
                      {d.isLatest ? null : (
                        <Badge variant="secondary" className="ml-1 font-normal">
                          Older
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">v{d.version}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(d.createdAt), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                      {d.materializerName}
                      {d.isMaterializerAvailable ? null : (
                        <Badge variant="destructive" className="ml-2 font-normal">
                          unavailable
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="pr-2">
                      <DefinitionRowMenu definition={d} onAction={onRowAction} />
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

      <CreateDefinitionDialog open={showCreate} onOpenChange={setShowCreate} />
      <CloneDefinitionDialog
        open={!!clone}
        onOpenChange={(o) => !o && setClone(null)}
        source={clone}
      />
      {exportTarget ? (
        exportTarget.mode === "single" ? (
          <ExportDefinitionDialog
            open
            onOpenChange={(o) => !o && setExportTarget(null)}
            mode="single"
            definitionId={exportTarget.definition.definitionId}
            defaultFilename={`${exportTarget.definition.name || "workflow"}.json`}
          />
        ) : (
          <ExportDefinitionDialog
            open
            onOpenChange={(o) => !o && setExportTarget(null)}
            mode="bulk"
            ids={exportTarget.ids}
          />
        )
      ) : null}
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
      <MarkdownViewerDialog
        open={!!descriptionView}
        onOpenChange={(o) => !o && setDescriptionView(null)}
        title={descriptionView?.name || "Description"}
        subtitle={descriptionView?.name ? "Workflow description" : undefined}
        content={descriptionView?.description ?? ""}
      />
    </div>
  );
}

/**
 * Clickable column header showing an asc/desc indicator when active.
 * Acts as a plain button-styled span so the header row stays compact.
 */
function SortHeader({
  label,
  active,
  direction,
  onClick,
  alignEnd = false,
}: {
  label: string;
  active: boolean;
  direction: OrderDirection;
  onClick: () => void;
  alignEnd?: boolean;
}) {
  const Indicator =
    !active ? ArrowUpDown : direction === "Ascending" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex select-none items-center gap-1 text-left text-xs font-medium uppercase tracking-wide transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        alignEnd ? "w-full justify-end" : "",
      ].join(" ")}
    >
      <span>{label}</span>
      <Indicator className="size-3" />
    </button>
  );
}

// Re-export so the union type is reachable in tests if needed.
export type { ConfirmKind };
