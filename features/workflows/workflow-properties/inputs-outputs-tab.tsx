"use client";

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { EditInputDialog } from "@/features/workflows/workflow-properties/edit-input-dialog";
import { EditOutputDialog } from "@/features/workflows/workflow-properties/edit-output-dialog";
import { OutcomesChipInput } from "@/features/workflows/workflow-properties/outcomes-chip-input";
import { friendlyTypeLabel } from "@/features/workflows/workflow-properties/type-display";
import { labelForUiHint } from "@/features/workflows/workflow-properties/ui-hints";
import type { InputDefinition, OutputDefinition } from "@/lib/api/types";

export function InputsOutputsTab() {
  const definition = useEditorStore((s) => s.definition);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  if (!definition) return null;

  const readOnly = !!definition.isReadonly;

  return (
    <div className="flex flex-col gap-6">
      <InputsSection readOnly={readOnly} />
      <OutputsSection readOnly={readOnly} />
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Outcomes</h3>
        <OutcomesChipInput
          value={definition.outcomes ?? []}
          onChange={(next) => setDefinition((prev) => ({ ...prev, outcomes: next }))}
          readOnly={readOnly}
          placeholder="Add an outcome and press Enter…"
        />
        <p className="text-muted-foreground text-xs">
          Workflow-level outcomes appear in activity outcome pickers and on the workflow&apos;s
          completion event.
        </p>
      </section>
    </div>
  );
}

function InputsSection({ readOnly }: { readOnly: boolean }) {
  const inputs = useEditorStore((s) => s.definition?.inputs ?? []);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<InputDefinition | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<InputDefinition | null>(null);

  const doDelete = () => {
    if (!confirmDelete) return;
    setDefinition((prev) => ({
      ...prev,
      inputs: (prev.inputs ?? []).filter((x) => x.name !== confirmDelete.name),
    }));
    setConfirmDelete(null);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Inputs</h3>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={readOnly}>
          <Plus className="size-3.5" /> Add input
        </Button>
      </div>

      {inputs.length === 0 ? (
        <p className="text-muted-foreground text-xs">No inputs defined.</p>
      ) : (
        <div className="bg-card overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">UI Hint</TableHead>
                <TableHead className="hidden md:table-cell">Storage</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {inputs.map((i) => (
                <TableRow key={i.name}>
                  <TableCell className="font-medium">
                    {i.displayName || i.name}
                    {i.displayName && i.displayName !== i.name ? (
                      <span className="text-muted-foreground ml-1 font-mono text-2xs">
                        ({i.name})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {friendlyTypeLabel(undefined, i.type)}
                    {i.isArray ? <Badge variant="outline" className="ml-1 font-normal">[]</Badge> : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                    {labelForUiHint(i.uiHint)}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-xs md:table-cell">
                    {i.storageDriverType
                      ? friendlyTypeLabel(undefined, i.storageDriverType).replace(/StorageDriver$/, "")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <RowMenu
                      readOnly={readOnly}
                      onEdit={() => setEditing(i)}
                      onDelete={() => setConfirmDelete(i)}
                      ariaLabel={`Actions for input ${i.name}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditInputDialog open={showCreate} onOpenChange={setShowCreate} />
      <EditInputDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        editing={editing}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete input?"
        description={
          confirmDelete ? (
            <>
              Remove <strong>{confirmDelete.name}</strong> from this workflow. Activities bound to
              it will show a missing-binding warning until rebound.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDelete}
      />
    </section>
  );
}

function OutputsSection({ readOnly }: { readOnly: boolean }) {
  const outputs = useEditorStore((s) => s.definition?.outputs ?? []);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<OutputDefinition | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OutputDefinition | null>(null);

  const doDelete = () => {
    if (!confirmDelete) return;
    setDefinition((prev) => ({
      ...prev,
      outputs: (prev.outputs ?? []).filter((x) => x.name !== confirmDelete.name),
    }));
    setConfirmDelete(null);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Outputs</h3>
        <Button size="sm" onClick={() => setShowCreate(true)} disabled={readOnly}>
          <Plus className="size-3.5" /> Add output
        </Button>
      </div>

      {outputs.length === 0 ? (
        <p className="text-muted-foreground text-xs">No outputs defined.</p>
      ) : (
        <div className="bg-card overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {outputs.map((o) => (
                <TableRow key={o.name}>
                  <TableCell className="font-medium">
                    {o.displayName || o.name}
                    {o.displayName && o.displayName !== o.name ? (
                      <span className="text-muted-foreground ml-1 font-mono text-2xs">
                        ({o.name})
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-xs">
                    {friendlyTypeLabel(undefined, o.type)}
                    {o.isArray ? <Badge variant="outline" className="ml-1 font-normal">[]</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <RowMenu
                      readOnly={readOnly}
                      onEdit={() => setEditing(o)}
                      onDelete={() => setConfirmDelete(o)}
                      ariaLabel={`Actions for output ${o.name}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <EditOutputDialog open={showCreate} onOpenChange={setShowCreate} />
      <EditOutputDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        editing={editing}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete output?"
        description={
          confirmDelete ? (
            <>
              Remove <strong>{confirmDelete.name}</strong> from this workflow. Activities bound to
              it will show a missing-binding warning until rebound.
            </>
          ) : undefined
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={doDelete}
      />
    </section>
  );
}

function RowMenu({
  readOnly,
  onEdit,
  onDelete,
  ariaLabel,
}: {
  readOnly: boolean;
  onEdit: () => void;
  onDelete: () => void;
  ariaLabel: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={readOnly}
        aria-label={ariaLabel}
        className="text-muted-foreground hover:bg-muted hover:text-foreground -m-1 inline-flex size-6 cursor-default items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-3.5" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
