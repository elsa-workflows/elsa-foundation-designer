"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { makeFlowchart } from "@/features/workflows/make-flowchart";
import { makeSequence } from "@/features/workflows/make-sequence";
import { makeStateMachine } from "@/features/workflows/make-state-machine";
import { useDebouncedValue } from "@/features/workflows/use-debounced";
import {
  generateUniqueDefinitionName,
  useActivityDescriptors,
  useCreateDefinition,
  useIsNameUnique,
} from "@/lib/api/elsa";

type RootKind = "flowchart" | "sequence" | "stateMachine";

const ROOT_OPTIONS: { value: RootKind; label: string; hint: string }[] = [
  {
    value: "flowchart",
    label: "Flowchart",
    hint: "Free-form activities with explicit connections between ports.",
  },
  {
    value: "sequence",
    label: "Sequence",
    hint: "Activities run top-to-bottom (or left-to-right) in the order you place them.",
  },
  {
    value: "stateMachine",
    label: "State machine",
    hint: "States connected by transitions; triggers and conditions decide which fires.",
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Public wrapper: keys the inner form on `open` so each opening starts fresh
 * without setState-in-effect. Closing keeps the previous DOM mounted just
 * long enough for the close animation.
 */
export function CreateDefinitionDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open ? <CreateForm onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CreateForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const create = useCreateDefinition();
  const descriptors = useActivityDescriptors();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rootKind, setRootKind] = useState<RootKind>("flowchart");
  const debouncedName = useDebouncedValue(name, 300);
  const unique = useIsNameUnique(debouncedName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => inputRef.current?.focus());
    void (async () => {
      const generated = await generateUniqueDefinitionName();
      if (cancelled) return;
      setName((current) => {
        if (current !== "") return current;
        requestAnimationFrame(() => inputRef.current?.select());
        return generated;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const nameTrimmed = name.trim();
  const nameTaken =
    nameTrimmed.length > 0 &&
    unique.data &&
    unique.data.isUnique === false &&
    debouncedName === nameTrimmed;
  const canSubmit = nameTrimmed.length > 0 && !create.isPending && !nameTaken;

  const submit = async () => {
    if (!canSubmit) return;
    try {
      const descriptorList = descriptors.data ?? [];
      const root =
        rootKind === "sequence"
          ? makeSequence(descriptorList)
          : rootKind === "stateMachine"
            ? makeStateMachine(descriptorList)
            : makeFlowchart(descriptorList);
      const res = await create.mutateAsync({
        name: nameTrimmed,
        description: description.trim() || undefined,
        root,
      });
      const definitionId = res.workflowDefinition.definitionId;
      onClose();
      router.push(`/workflows/definitions/${definitionId}/edit`);
    } catch {
      toast.error("Couldn't create the workflow.");
    }
  };

  return (
    <>
      <DialogHeader>
          <DialogTitle>New workflow</DialogTitle>
          <DialogDescription>
            Pick a name and you&apos;ll land in the designer to start adding activities.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!nameTaken || undefined}
              placeholder="e.g. order-processing"
              autoComplete="off"
            />
            {nameTaken ? (
              <p className="text-destructive text-xs">A workflow with this name already exists.</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="wf-desc">Description (optional)</Label>
            <Textarea
              id="wf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What does this workflow do?"
            />
          </div>

          <fieldset className="grid gap-1.5">
            <legend className="text-sm font-medium">Root type</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROOT_OPTIONS.map((opt) => {
                const checked = rootKind === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={[
                      "flex cursor-pointer flex-col gap-1 rounded-md border px-3 py-2 text-left transition-colors",
                      checked
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="wf-root-kind"
                      value={opt.value}
                      checked={checked}
                      onChange={() => setRootKind(opt.value)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-muted-foreground text-xs leading-snug">
                      {opt.hint}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button" disabled={create.isPending} />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!canSubmit}>
              {create.isPending ? "Creating…" : "Create workflow"}
            </Button>
          </DialogFooter>
        </form>
    </>
  );
}
