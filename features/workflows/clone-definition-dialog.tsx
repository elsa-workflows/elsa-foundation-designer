"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recomputeNodeIds } from "@/features/workflows/node-id";
import { useDebouncedValue } from "@/features/workflows/use-debounced";
import {
  useIsNameUnique,
  useSaveWorkflowDefinition,
  useWorkflowDefinition,
} from "@/lib/api/elsa";
import type { WorkflowDefinition, WorkflowDefinitionSummary } from "@/lib/api/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: Pick<WorkflowDefinitionSummary, "definitionId" | "name" | "description"> | null;
  /** Fires after a successful clone. Useful for "Save as…" redirects. */
  onCloned?: (def: WorkflowDefinition) => void;
};

export function CloneDefinitionDialog({ open, onOpenChange, source, onCloned }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && source ? (
          <CloneForm
            source={source}
            onClose={() => onOpenChange(false)}
            onCloned={onCloned}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CloneForm({
  source,
  onClose,
  onCloned,
}: {
  source: Pick<WorkflowDefinitionSummary, "definitionId" | "name" | "description">;
  onClose: () => void;
  onCloned?: (def: WorkflowDefinition) => void;
}) {
  const full = useWorkflowDefinition(source.definitionId, "Latest");
  const save = useSaveWorkflowDefinition();
  const [name, setName] = useState(`${source.name} (copy)`);
  const [description, setDescription] = useState(source.description ?? "");
  const debouncedName = useDebouncedValue(name, 300);
  const unique = useIsNameUnique(debouncedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const trimmed = name.trim();
  const taken =
    trimmed.length > 0 &&
    unique.data?.isUnique === false &&
    debouncedName === trimmed;
  const canSubmit =
    trimmed.length > 0 && !!full.data && !save.isPending && !taken;

  const submit = async () => {
    if (!canSubmit || !full.data) return;
    try {
      const res = await save.mutateAsync({
        model: {
          definitionId: crypto.randomUUID(),
          tenantId: null,
          name: trimmed,
          description: description.trim() || null,
          variables: full.data.variables,
          inputs: full.data.inputs,
          outputs: full.data.outputs,
          outcomes: full.data.outcomes,
          customProperties: full.data.customProperties,
          options: full.data.options,
          // Recompute nodeIds so the clone has a clean spine rooted at the
          // new workflow name, rather than inheriting the source's path.
          root: recomputeNodeIds(full.data.root, trimmed || "Workflow1"),
        },
      });
      toast.success("Workflow duplicated.");
      onClose();
      onCloned?.(res.workflowDefinition);
    } catch {
      toast.error("Couldn't duplicate the workflow.");
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Duplicate workflow</DialogTitle>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="clone-name">Name</Label>
          <Input
            id="clone-name"
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!taken || undefined}
          />
          {taken ? (
            <p className="text-destructive text-xs">A workflow with this name already exists.</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="clone-desc">Description</Label>
          <Textarea
            id="clone-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" disabled={save.isPending} />}>
            Cancel
          </DialogClose>
          <Button type="submit" disabled={!canSubmit}>
            {save.isPending ? "Duplicating…" : "Duplicate"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
