"use client";

import { Loader2, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";
import { useExecuteDefinition } from "@/lib/api/elsa";
import type { InputDefinition, WorkflowDefinition } from "@/lib/api/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: WorkflowDefinition;
  onStarted?: (instanceId: string | undefined) => void;
};

/**
 * Pre-execute dialog: prompts the user for the workflow's declared inputs,
 * then kicks off an instance with the populated values. Skips entirely (and
 * executes directly) when the workflow declares no browsable inputs.
 *
 * Default values fall through to the input's `defaultValue` so the user can
 * just hit Run when nothing needs to change.
 */
export function RunWorkflowDialog({ open, onOpenChange, definition, onStarted }: Props) {
  const execute = useExecuteDefinition();
  const inputs = useMemo(
    () => (definition.inputs ?? []).filter((i) => i.uiHint !== undefined),
    [definition.inputs],
  );

  const [values, setValues] = useState<Record<string, unknown>>(() => seedValues(inputs));

  const onRun = async () => {
    try {
      const res = await execute.mutateAsync({
        definitionId: definition.definitionId,
        request: { input: values },
      });
      if (res.cannotStart) {
        toast.error("Workflow can't start (no published version or missing trigger).");
        return;
      }
      onStarted?.(res.workflowInstanceId);
      toast.success("Workflow started.");
      onOpenChange(false);
    } catch {
      toast.error("Couldn't start the workflow.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run workflow</DialogTitle>
          <DialogDescription>
            Provide values for the workflow inputs. Leave blank to use defaults.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto"
          onSubmit={(e) => {
            e.preventDefault();
            void onRun();
          }}
        >
          {inputs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This workflow doesn&apos;t declare any inputs.
            </p>
          ) : (
            inputs.map((input) => (
              <InputRow
                key={input.name}
                input={input}
                value={values[input.name]}
                onChange={(v) => setValues((prev) => ({ ...prev, [input.name]: v }))}
              />
            ))
          )}
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" type="button" />}>Cancel</DialogClose>
          <Button
            type="button"
            onClick={() => void onRun()}
            disabled={execute.isPending}
          >
            {execute.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" />
            )}
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Lightweight per-input editor. We don't reuse the full activity input
 * pipeline here (no descriptor / wrapped envelope / syntax cycling); the
 * Blazor designer's Run dialog uses naked literals too — the runtime parses
 * them against the input's declared type.
 */
function InputRow({
  input,
  value,
  onChange,
}: {
  input: InputDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const id = `run-${input.name}`;
  const label = input.displayName?.trim() || input.name;
  const isBool =
    input.type === "System.Boolean" || input.type?.toLowerCase().includes("bool");
  const isNumber =
    input.type === "System.Int32" ||
    input.type === "System.Int64" ||
    input.type === "System.Double" ||
    input.type?.toLowerCase().includes("int") ||
    input.type?.toLowerCase().includes("number");
  const isMultiline =
    input.uiHint === "multiline" || input.uiHint === "code-editor" || input.uiHint === "json-editor";

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-xs font-medium">
          {label}
        </Label>
        <span className="text-muted-foreground ml-auto font-mono text-2xs">
          {shortType(input.type)}
          {input.isArray ? "[]" : ""}
        </span>
      </div>
      {input.description ? (
        <p className="text-muted-foreground text-xs">{input.description}</p>
      ) : null}
      {isBool ? (
        <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
          <Checkbox
            checked={value === true}
            onCheckedChange={(c) => onChange(!!c)}
          />
          {label}
        </Label>
      ) : isMultiline ? (
        <Textarea
          id={id}
          rows={4}
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono text-xs"
        />
      ) : (
        <Input
          id={id}
          type={isNumber ? "number" : "text"}
          value={value == null ? "" : String(value)}
          onChange={(e) => {
            const v = e.target.value;
            if (isNumber) {
              if (v === "") return onChange(null);
              const parsed = Number(v);
              return onChange(Number.isFinite(parsed) ? parsed : v);
            }
            onChange(v);
          }}
        />
      )}
    </div>
  );
}

function seedValues(inputs: InputDefinition[]): Record<string, unknown> {
  const seed: Record<string, unknown> = {};
  for (const i of inputs) {
    if (i.defaultValue !== undefined && i.defaultValue !== null) {
      seed[i.name] = i.defaultValue;
    }
  }
  return seed;
}

function shortType(name: string | undefined): string {
  if (!name) return "";
  const segs = name.split(".");
  return segs[segs.length - 1] ?? name;
}
