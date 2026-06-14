"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useEditorStore } from "@/features/workflows/editor-store";
import { friendlyTypeLabel } from "@/features/workflows/workflow-properties/type-display";
import { useVariableTypes } from "@/lib/api/elsa";
import type { OutputDefinition, VariableTypeDescriptor } from "@/lib/api/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: OutputDefinition | null;
};

/**
 * Add / edit a workflow output. Smaller field set than inputs — outputs
 * are produced by activities and don't have their own editor or storage
 * driver. Same uniqueness-by-name validation.
 */
export function EditOutputDialog({ open, onOpenChange, editing }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <EditForm onClose={() => onOpenChange(false)} editing={editing ?? null} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  onClose,
  editing,
}: {
  onClose: () => void;
  editing: OutputDefinition | null;
}) {
  const outputs = useEditorStore((s) => s.definition?.outputs ?? []);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  const types = useVariableTypes();

  const isEditing = !!editing;
  const defaultName = useMemo(() => {
    if (editing) return editing.name;
    let i = outputs.length + 1;
    let candidate = `Output${i}`;
    while (outputs.some((x) => x.name === candidate)) {
      i += 1;
      candidate = `Output${i}`;
    }
    return candidate;
  }, [outputs, editing]);

  const [name, setName] = useState(defaultName);
  const [displayName, setDisplayName] = useState(editing?.displayName ?? defaultName);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [typeName, setTypeName] = useState(editing?.type ?? "");
  const [isArray, setIsArray] = useState(editing?.isArray ?? false);

  useEffect(() => {
    if (!types.data || types.data.length === 0 || typeName) return;
    const preferred = types.data.find((t) => t.typeName === "System.String");
    setTypeName(preferred?.typeName ?? types.data[0].typeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.data]);

  const typeItems = useMemo(
    () =>
      (types.data ?? []).map((t) => ({
        label: friendlyTypeLabel(t.displayName, t.typeName),
        value: t.typeName,
      })),
    [types.data],
  );
  const groupedTypes = useMemo(() => {
    const buckets = new Map<string, VariableTypeDescriptor[]>();
    for (const t of types.data ?? []) {
      const key = t.category?.trim() || "Other";
      const list = buckets.get(key) ?? [];
      list.push(t);
      buckets.set(key, list);
    }
    return [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [types.data]);

  const trimmed = name.trim();
  const taken =
    trimmed.length > 0 &&
    outputs.some((x) => x.name === trimmed && (!isEditing || x.name !== editing!.name));
  const canSubmit = trimmed.length > 0 && !taken && !!typeName;

  const submit = () => {
    if (!canSubmit) return;
    const next: OutputDefinition = {
      name: trimmed,
      displayName: displayName.trim() || trimmed,
      description: description.trim(),
      category: category.trim(),
      type: typeName,
      isArray,
    };
    setDefinition((prev) => {
      const list = prev.outputs ?? [];
      if (isEditing) {
        return { ...prev, outputs: list.map((x) => (x.name === editing!.name ? next : x)) };
      }
      return { ...prev, outputs: [...list, next] };
    });
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit output" : "New output"}</DialogTitle>
        <DialogDescription>
          Workflow outputs are values produced by activities and returned to the caller when the
          workflow finishes.
        </DialogDescription>
      </DialogHeader>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="eo-name">Name</Label>
          <Input
            id="eo-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={taken || undefined}
            autoFocus
          />
          {taken ? (
            <p className="text-destructive text-xs">An output with this name already exists.</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="eo-display">Display name</Label>
          <Input
            id="eo-display"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={trimmed}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="eo-type">Type</Label>
          <Select items={typeItems} value={typeName} onValueChange={(v) => v && setTypeName(v)}>
            <SelectTrigger id="eo-type" size="sm" className="w-full">
              <SelectValue placeholder={types.isPending ? "Loading…" : "Choose a type"} />
            </SelectTrigger>
            <SelectContent>
              {groupedTypes.map(([cat, items]) => (
                <SelectGroup key={cat}>
                  <SelectLabel>{cat}</SelectLabel>
                  {items.map((t) => (
                    <SelectItem key={t.typeName} value={t.typeName}>
                      {friendlyTypeLabel(t.displayName, t.typeName)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
          <Checkbox checked={isArray} onCheckedChange={(c) => setIsArray(c)} />
          Is array
        </Label>

        <div className="grid gap-1.5">
          <Label htmlFor="eo-desc">Description</Label>
          <Textarea
            id="eo-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="eo-category">Category</Label>
          <Input
            id="eo-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button type="submit" disabled={!canSubmit}>
            {isEditing ? "Save changes" : "Add output"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
