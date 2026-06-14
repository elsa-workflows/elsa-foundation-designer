"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  AlterationDescriptor,
  AlterationFieldSpec,
} from "@/features/alterations/catalog";
import { useWorkflowDefinitionVersions } from "@/lib/api/elsa";
import type { VariableDefinition } from "@/lib/api/types";

type TargetActivity = { id: string; displayName: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  descriptor: AlterationDescriptor;
  targetActivity?: TargetActivity;
  initialValues: Record<string, string>;
  definitionId: string;
  definitionVariables: VariableDefinition[];
  liveVariables: Record<string, unknown>;
  onSubmit: (values: Record<string, string>) => void;
};

export function ConfigDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {props.open ? <ConfigForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ConfigForm({
  descriptor,
  targetActivity,
  initialValues,
  definitionId,
  definitionVariables,
  liveVariables,
  onSubmit,
  onOpenChange,
}: Props) {
  // Inner form remounts each time the outer Dialog opens (see ConfigDialog),
  // so initialValues is captured at mount-time and there's no need to sync
  // it into state via an effect.
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fields = descriptor.fields ?? [];

  const setField = (key: string, v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const submit = () => {
    const next: Record<string, string> = {};
    for (const f of fields) {
      const raw = values[f.key] ?? "";
      if (f.required && raw === "") {
        next[f.key] = "Required.";
        continue;
      }
      if (raw === "") continue;
      if (f.kind === "Integer" || f.kind === "VersionPicker") {
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n)) {
          next[f.key] = "Must be a whole number.";
        }
      }
      if (f.kind === "Json") {
        try {
          JSON.parse(raw);
        } catch {
          next[f.key] = "Invalid JSON.";
        }
      }
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    onSubmit(values);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <descriptor.icon className="size-4" />
          {descriptor.displayName}
        </DialogTitle>
        <DialogDescription>{descriptor.description}</DialogDescription>
      </DialogHeader>
      {targetActivity ? (
        <div className="bg-muted/40 rounded-md border p-2 text-xs">
          <span className="text-muted-foreground">Target activity: </span>
          <span className="font-medium">{targetActivity.displayName}</span>
          <span className="text-muted-foreground ml-1 font-mono">
            ({targetActivity.id})
          </span>
        </div>
      ) : null}
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {fields.map((field) => (
          <FieldRow
            key={field.key}
            field={field}
            value={values[field.key] ?? ""}
            error={errors[field.key]}
            onChange={(v) => setField(field.key, v)}
            definitionId={definitionId}
            definitionVariables={definitionVariables}
            liveVariables={liveVariables}
          />
        ))}
        <DialogFooter>
          <DialogClose
            render={<Button variant="outline" type="button" />}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </DialogClose>
          <Button type="submit">
            {Object.keys(initialValues).length > 0 ? "Update" : "Add to plan"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

function FieldRow({
  field,
  value,
  error,
  onChange,
  definitionId,
  definitionVariables,
  liveVariables,
}: {
  field: AlterationFieldSpec;
  value: string;
  error?: string;
  onChange: (v: string) => void;
  definitionId: string;
  definitionVariables: VariableDefinition[];
  liveVariables: Record<string, unknown>;
}) {
  const id = `alt-field-${field.key}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {field.displayName}
        {field.required ? (
          <span className="text-destructive ml-0.5">*</span>
        ) : null}
      </Label>
      {renderInput(
        field,
        id,
        value,
        onChange,
        !!error,
        definitionId,
        definitionVariables,
        liveVariables,
      )}
      {field.helperText && !error ? (
        <p className="text-muted-foreground text-xs">{field.helperText}</p>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function renderInput(
  field: AlterationFieldSpec,
  id: string,
  value: string,
  onChange: (v: string) => void,
  hasError: boolean,
  definitionId: string,
  definitionVariables: VariableDefinition[],
  liveVariables: Record<string, unknown>,
) {
  switch (field.kind) {
    case "Text":
      return (
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError || undefined}
        />
      );
    case "Integer":
      return (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError || undefined}
        />
      );
    case "Json":
      return (
        <Textarea
          id={id}
          rows={4}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={hasError || undefined}
          className="font-mono text-xs"
          placeholder='"text" | 42 | { "key": "value" }'
        />
      );
    case "VariablePicker":
      return (
        <VariablePicker
          id={id}
          value={value}
          onChange={onChange}
          definitionVariables={definitionVariables}
          liveVariables={liveVariables}
        />
      );
    case "VersionPicker":
      return (
        <VersionPicker
          id={id}
          value={value}
          onChange={onChange}
          definitionId={definitionId}
        />
      );
  }
}

function VariablePicker({
  id,
  value,
  onChange,
  definitionVariables,
  liveVariables,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  definitionVariables: VariableDefinition[];
  liveVariables: Record<string, unknown>;
}) {
  const items = useMemo(() => {
    return definitionVariables.map((v) => ({
      key: v.id,
      label: v.name,
      preview:
        liveVariables[v.name] !== undefined
          ? truncate(JSON.stringify(liveVariables[v.name]), 30)
          : null,
    }));
  }, [definitionVariables, liveVariables]);

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger id={id} size="sm" className="w-full">
        <SelectValue placeholder="Choose a variable" />
      </SelectTrigger>
      <SelectContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground p-2 text-xs italic">
            No variables on this workflow.
          </p>
        ) : (
          items.map((item) => (
            <SelectItem key={item.key} value={item.key}>
              {item.label}
              {item.preview ? (
                <span className="text-muted-foreground ml-1 font-mono text-[10px]">
                  ({item.preview})
                </span>
              ) : null}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

function VersionPicker({
  id,
  value,
  onChange,
  definitionId,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  definitionId: string;
}) {
  const q = useWorkflowDefinitionVersions(definitionId);
  const items = useMemo(() => {
    const list = q.data?.items ?? [];
    return list
      .filter((v) => v.isPublished)
      .sort((a, b) => b.version - a.version);
  }, [q.data]);

  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger id={id} size="sm" className="w-full">
        <SelectValue
          placeholder={q.isPending ? "Loading versions…" : "Choose a version"}
        />
      </SelectTrigger>
      <SelectContent>
        {items.length === 0 && !q.isPending ? (
          <p className="text-muted-foreground p-2 text-xs italic">
            No published versions.
          </p>
        ) : (
          items.map((v) => (
            <SelectItem key={v.id} value={String(v.version)}>
              v{v.version}
              {v.isLatest ? (
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  latest
                </Badge>
              ) : null}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
