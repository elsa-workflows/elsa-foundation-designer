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
import { KNOWN_UI_HINTS } from "@/features/workflows/workflow-properties/ui-hints";
import { useStorageDrivers, useVariableTypes } from "@/lib/api/elsa";
import type { InputDefinition, VariableTypeDescriptor } from "@/lib/api/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this input; otherwise it creates a new one. */
  editing?: InputDefinition | null;
  /**
   * Called once the user creates a new input (not fired on edit). Lets callers
   * auto-select the freshly added input in the surrounding picker — mirrors
   * `CreateVariableDialog.onCreated`.
   */
  onCreated?: (input: InputDefinition) => void;
};

/**
 * Add / edit a workflow input. Mirrors `EditInputDialog.razor`: full field
 * set (Name, Type, Is array, Display name, Description, Category, UI Hint,
 * Storage driver). Submit is disabled while the name is missing or
 * duplicated against the rest of the input list.
 */
export function EditInputDialog({ open, onOpenChange, editing, onCreated }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <EditForm
            onClose={() => onOpenChange(false)}
            editing={editing ?? null}
            onCreated={onCreated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  onClose,
  editing,
  onCreated,
}: {
  onClose: () => void;
  editing: InputDefinition | null;
  onCreated?: (input: InputDefinition) => void;
}) {
  const inputs = useEditorStore((s) => s.definition?.inputs ?? []);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  const types = useVariableTypes();
  const drivers = useStorageDrivers();

  const isEditing = !!editing;
  const defaultName = useMemo(() => {
    if (editing) return editing.name;
    let i = inputs.length + 1;
    let candidate = `Input${i}`;
    while (inputs.some((x) => x.name === candidate)) {
      i += 1;
      candidate = `Input${i}`;
    }
    return candidate;
  }, [inputs, editing]);

  const [name, setName] = useState(defaultName);
  const [displayName, setDisplayName] = useState(editing?.displayName ?? defaultName);
  const [description, setDescription] = useState(editing?.description ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [typeName, setTypeName] = useState(editing?.type ?? "");
  const [isArray, setIsArray] = useState(editing?.isArray ?? false);
  const [uiHint, setUiHint] = useState(editing?.uiHint ?? "singleline");
  const [storage, setStorage] = useState(editing?.storageDriverType ?? "");
  const [defaultValue, setDefaultValue] = useState<string>(
    typeof editing?.defaultValue === "string" ? editing.defaultValue : "",
  );
  const [defaultSyntax, setDefaultSyntax] = useState<string>(editing?.defaultSyntax ?? "Literal");
  const [isReadOnly, setIsReadOnly] = useState<boolean>(editing?.isReadOnly === true);

  useEffect(() => {
    if (!types.data || types.data.length === 0 || typeName) return;
    const preferred = types.data.find((t) => t.typeName === "System.String");
    setTypeName(preferred?.typeName ?? types.data[0].typeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types.data]);

  useEffect(() => {
    if (!drivers.data || drivers.data.length === 0 || storage) return;
    const preferred = drivers.data.find((d) => !d.deprecated) ?? drivers.data[0];
    setStorage(preferred.typeName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers.data]);

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
  const driverItems = useMemo(
    () =>
      (drivers.data ?? []).map((d) => ({
        label: friendlyTypeLabel(d.displayName, d.typeName).replace(/StorageDriver$/, "") +
          (d.deprecated ? " (deprecated)" : ""),
        value: d.typeName,
      })),
    [drivers.data],
  );
  const uiHintItems = useMemo(
    () => KNOWN_UI_HINTS.map((h) => ({ label: h.label, value: h.value })),
    [],
  );

  const trimmed = name.trim();
  const taken =
    trimmed.length > 0 &&
    inputs.some((x) => x.name === trimmed && (!isEditing || x.name !== editing!.name));
  const canSubmit = trimmed.length > 0 && !taken && !!typeName;

  const submit = () => {
    if (!canSubmit) return;
    const next: InputDefinition = {
      name: trimmed,
      displayName: displayName.trim() || trimmed,
      description: description.trim(),
      category: category.trim(),
      type: typeName,
      isArray,
      uiHint: uiHint || "singleline",
      storageDriverType: storage || null,
      defaultValue: defaultValue.trim() ? defaultValue : null,
      defaultSyntax: defaultSyntax || null,
      isReadOnly: isReadOnly || null,
    };
    setDefinition((prev) => {
      const list = prev.inputs ?? [];
      if (isEditing) {
        const replaced = list.map((x) => (x.name === editing!.name ? next : x));
        return { ...prev, inputs: replaced };
      }
      return { ...prev, inputs: [...list, next] };
    });
    if (!isEditing) onCreated?.(next);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit input" : "New input"}</DialogTitle>
        <DialogDescription>
          Workflow inputs are values the caller can pass when starting the workflow. The UI Hint
          controls which editor each activity sees when binding to this input.
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
          <Label htmlFor="ei-name">Name</Label>
          <Input
            id="ei-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={taken || undefined}
            autoFocus
          />
          {taken ? (
            <p className="text-destructive text-xs">An input with this name already exists.</p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ei-display">Display name</Label>
          <Input
            id="ei-display"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={trimmed}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ei-type">Type</Label>
          <Select items={typeItems} value={typeName} onValueChange={(v) => v && setTypeName(v)}>
            <SelectTrigger id="ei-type" size="sm" className="w-full">
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
          <Label htmlFor="ei-desc">Description</Label>
          <Textarea
            id="ei-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ei-category">Category</Label>
          <Input
            id="ei-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Used to group inputs in the activity panel"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ei-uihint">UI Hint</Label>
          <Select items={uiHintItems} value={uiHint} onValueChange={(v) => v && setUiHint(v)}>
            <SelectTrigger id="ei-uihint" size="sm" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_UI_HINTS.map((h) => (
                <SelectItem key={h.value} value={h.value}>
                  <span className="flex flex-col gap-0.5">
                    <span>{h.label}</span>
                    {h.description ? (
                      <span className="text-muted-foreground text-xs">{h.description}</span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ei-storage">Storage driver</Label>
          <Select items={driverItems} value={storage} onValueChange={(v) => v && setStorage(v)}>
            <SelectTrigger id="ei-storage" size="sm" className="w-full">
              <SelectValue placeholder={drivers.isPending ? "Loading…" : "Default"} />
            </SelectTrigger>
            <SelectContent>
              {(drivers.data ?? []).map((d) => (
                <SelectItem key={d.typeName} value={d.typeName}>
                  {friendlyTypeLabel(d.displayName, d.typeName).replace(/StorageDriver$/, "")}
                  {d.deprecated ? (
                    <span className="text-muted-foreground ml-1 text-2xs">(deprecated)</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ei-default">Default value</Label>
          <Textarea
            id="ei-default"
            rows={2}
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            placeholder="Pre-fills the input when the caller doesn't pass one"
            className="font-mono text-xs"
          />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="ei-default-syntax">Default syntax</Label>
          <Select value={defaultSyntax} onValueChange={(v) => v && setDefaultSyntax(v)}>
            <SelectTrigger id="ei-default-syntax" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Literal", "JavaScript", "C#", "Liquid", "Python", "Object", "SQL"].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
          <Checkbox checked={isReadOnly} onCheckedChange={(c) => setIsReadOnly(!!c)} />
          Read-only at runtime (caller can&apos;t override)
        </Label>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button type="submit" disabled={!canSubmit}>
            {isEditing ? "Save changes" : "Add input"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
