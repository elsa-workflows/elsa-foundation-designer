"use client";

import { format } from "date-fns";
import { Eye, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useEditorStore } from "@/features/workflows/editor-store";
import {
  useBulkDeleteDefinitionVersions,
  useDeleteDefinitionVersion,
  useRevertDefinitionVersion,
  useWorkflowDefinitionVersions,
} from "@/lib/api/elsa";
import type { WorkflowDefinitionSummary } from "@/lib/api/types";

export function VersionHistoryTab() {
  const router = useRouter();
  const definition = useEditorStore((s) => s.definition);
  const q = useWorkflowDefinitionVersions(definition?.definitionId);
  const revert = useRevertDefinitionVersion();
  const deleteVersion = useDeleteDefinitionVersion();
  const bulkDelete = useBulkDeleteDefinitionVersions();
  const [confirmDelete, setConfirmDelete] = useState<WorkflowDefinitionSummary | null>(null);
  const [confirmRevert, setConfirmRevert] = useState<WorkflowDefinitionSummary | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const items = useMemo(() => q.data?.items ?? [], [q.data?.items]);

  // Versions a user is allowed to bulk-select. The "current" version is the
  // active draft/published row and shouldn't be deletable from the bulk path.
  const selectableIds = useMemo(
    () =>
      items
        .filter((v) => v.version !== definition?.version)
        .map((v) => v.id),
    [items, definition?.version],
  );

  if (!definition) return null;
  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(selectableIds) : new Set());
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const doRevert = async () => {
    if (!confirmRevert) return;
    try {
      await revert.mutateAsync({
        definitionId: definition.definitionId,
        version: confirmRevert.version,
      });
      toast.success(`Reverted to v${confirmRevert.version}.`);
      router.refresh();
      setConfirmRevert(null);
    } catch {
      toast.error("Revert failed.");
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteVersion.mutateAsync(confirmDelete.id);
      toast.success("Version deleted.");
      setConfirmDelete(null);
    } catch {
      toast.error("Couldn't delete that version.");
    }
  };

  const doBulkDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    try {
      const targets = items
        .filter((v) => ids.includes(v.id))
        .map((v) => ({ id: v.id, definitionId: v.definitionId, version: v.version }));
      await bulkDelete.mutateAsync(targets);
      toast.success(`Deleted ${ids.length} version${ids.length === 1 ? "" : "s"}.`);
      setSelected(new Set());
      setConfirmBulk(false);
    } catch {
      toast.error("Bulk delete failed.");
    }
  };

  const selectedCount = selected.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Version history</h2>
        {selectedCount > 0 ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmBulk(true)}
            disabled={!!definition.isReadonly || bulkDelete.isPending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Delete selected ({selectedCount})
          </Button>
        ) : null}
      </div>
      <div className="bg-card overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all deletable versions"
                  checked={allSelectableSelected}
                  disabled={selectableIds.length === 0 || !!definition.isReadonly}
                  onCheckedChange={(c) => toggleAll(!!c)}
                />
              </TableHead>
              <TableHead className="w-24">Version</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isPending ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-6 text-center text-xs">
                  No versions yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((v) => {
                const isCurrent = v.version === definition.version;
                return (
                  <TableRow key={v.id}>
                    <TableCell>
                      {isCurrent ? (
                        <span className="text-muted-foreground/40 inline-flex size-4 items-center justify-center text-2xs">
                          —
                        </span>
                      ) : (
                        <Checkbox
                          aria-label={`Select v${v.version}`}
                          checked={selected.has(v.id)}
                          disabled={!!definition.isReadonly}
                          onCheckedChange={() => toggleOne(v.id)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">v{v.version}</TableCell>
                    <TableCell>
                      {v.isPublished ? (
                        <Badge className="font-normal">Published</Badge>
                      ) : (
                        <Badge variant="outline" className="font-normal">
                          Draft
                        </Badge>
                      )}
                      {isCurrent ? (
                        <Badge variant="secondary" className="ml-1 font-normal">
                          current
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(v.createdAt), "yyyy-MM-dd HH:mm")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="View this version"
                          onClick={() =>
                            router.push(`/workflows/definitions/${v.definitionId}?v=${v.version}`)
                          }
                          disabled={isCurrent}
                        >
                          <Eye className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Revert to this version"
                          onClick={() => setConfirmRevert(v)}
                          disabled={isCurrent || !!definition.isReadonly}
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Delete this version"
                          onClick={() => setConfirmDelete(v)}
                          disabled={isCurrent}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete this version?"
        description={
          confirmDelete
            ? `Version ${confirmDelete.version} will be removed. Other versions are unaffected.`
            : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        busy={deleteVersion.isPending}
        onConfirm={doDelete}
      />
      <ConfirmDialog
        open={!!confirmRevert}
        onOpenChange={(o) => !o && setConfirmRevert(null)}
        title={`Revert to v${confirmRevert?.version}?`}
        description="A new draft version is created from the chosen version's snapshot."
        confirmLabel="Revert"
        busy={revert.isPending}
        onConfirm={doRevert}
      />
      <ConfirmDialog
        open={confirmBulk}
        onOpenChange={setConfirmBulk}
        title={`Delete ${selectedCount} version${selectedCount === 1 ? "" : "s"}?`}
        description="The current version stays. Other selected versions are removed permanently."
        confirmLabel="Delete"
        variant="destructive"
        busy={bulkDelete.isPending}
        onConfirm={doBulkDelete}
      />
    </div>
  );
}
