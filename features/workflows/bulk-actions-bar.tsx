"use client";

import { CheckCircle2, Download, Trash2, X, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  selectedCount: number;
  onClear: () => void;
  onPublish: () => void;
  onRetract: () => void;
  onExport: () => void;
  onDelete: () => void;
  busy?: boolean;
};

/** Sticky action bar that appears when one or more rows are selected. */
export function BulkActionsBar({
  selectedCount,
  onClear,
  onPublish,
  onRetract,
  onExport,
  onDelete,
  busy = false,
}: Props) {
  if (selectedCount === 0) return null;
  return (
    <div className="bg-card flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 shadow-sm">
      <span className="text-sm font-medium tabular-nums">
        {selectedCount} selected
      </span>
      <Button variant="ghost" size="icon-sm" onClick={onClear} aria-label="Clear selection">
        <X className="size-3.5" />
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPublish} disabled={busy}>
          <CheckCircle2 className="size-3.5" /> Publish
        </Button>
        <Button variant="outline" size="sm" onClick={onRetract} disabled={busy}>
          <XCircle className="size-3.5" /> Unpublish
        </Button>
        <Button variant="outline" size="sm" onClick={onExport} disabled={busy}>
          <Download className="size-3.5" /> Export
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={busy}>
          <Trash2 className="size-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
