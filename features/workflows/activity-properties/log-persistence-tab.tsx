"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMetadataProperty,
  setMetadataProperty,
} from "@/features/workflows/activity-properties/custom-props";
import { MonacoCodeEditor } from "@/features/workflows/activity-properties/monaco-editor";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type { ActivityJson } from "@/lib/api/types";

const INHERIT = "Inherit";
const MODES = ["Inherit", "Include", "Exclude", "Expression"] as const;
type Mode = (typeof MODES)[number];

type SinglePersistenceConfig = {
  strategyType?: string | null;
  expression?: { type?: string; value?: string } | null;
};

type PersistenceConfig = {
  default?: SinglePersistenceConfig;
  internalState?: SinglePersistenceConfig;
  inputs?: Record<string, SinglePersistenceConfig>;
  outputs?: Record<string, SinglePersistenceConfig>;
};

/**
 * Per-property log persistence editor. Mirrors Blazor's `LogPersistenceTab`:
 *
 *   - Default — applied when no per-property override matches.
 *   - Internal state — the activity's own state object.
 *   - Inputs — one row per descriptor input.
 *   - Outputs — one row per descriptor output.
 *
 * Each row picks a mode (`Inherit / Include / Exclude / Expression`); when the
 * mode is Expression, a small Monaco editor appears so the user can compute
 * `true` (include) or `false` (exclude) at runtime.
 *
 * Stored at `metadata.logPersistenceConfig`.
 */
export function ActivityLogPersistenceTab({ activity }: { activity: ActivityJson }) {
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);
  const descriptors = useActivityDescriptors();

  const descriptor = useMemo(
    () => descriptors.data?.find((d) => d.typeName === activity.type) ?? null,
    [descriptors.data, activity.type],
  );

  const config = (getMetadataProperty<PersistenceConfig>(activity, "logPersistenceConfig") ?? {}) as PersistenceConfig;

  const writeConfig = (next: PersistenceConfig) => {
    if (!root) return;
    // Strip empty sections to keep the JSON clean.
    const cleaned: PersistenceConfig = {};
    if (next.default && configHasContent(next.default)) cleaned.default = next.default;
    if (next.internalState && configHasContent(next.internalState)) cleaned.internalState = next.internalState;
    if (next.inputs) {
      const ins: Record<string, SinglePersistenceConfig> = {};
      for (const [k, v] of Object.entries(next.inputs)) {
        if (configHasContent(v)) ins[k] = v;
      }
      if (Object.keys(ins).length > 0) cleaned.inputs = ins;
    }
    if (next.outputs) {
      const outs: Record<string, SinglePersistenceConfig> = {};
      for (const [k, v] of Object.entries(next.outputs)) {
        if (configHasContent(v)) outs[k] = v;
      }
      if (Object.keys(outs).length > 0) cleaned.outputs = outs;
    }
    setRoot(
      updateActivity(root, activity.id, (a) =>
        setMetadataProperty(a, "logPersistenceConfig", Object.keys(cleaned).length === 0 ? null : cleaned),
      ),
    );
  };

  const setDefault = (next: SinglePersistenceConfig) =>
    writeConfig({ ...config, default: next });
  const setInternal = (next: SinglePersistenceConfig) =>
    writeConfig({ ...config, internalState: next });
  const setInput = (name: string, next: SinglePersistenceConfig) =>
    writeConfig({ ...config, inputs: { ...(config.inputs ?? {}), [name]: next } });
  const setOutput = (name: string, next: SinglePersistenceConfig) =>
    writeConfig({ ...config, outputs: { ...(config.outputs ?? {}), [name]: next } });

  return (
    <div className="flex flex-col gap-4">
      <PersistenceRow
        label="Default"
        helper="Applies to anything that doesn't match a more specific rule below."
        value={config.default}
        readOnly={readOnly}
        onChange={setDefault}
      />
      <PersistenceRow
        label="Internal state"
        helper="The activity's own runtime state."
        value={config.internalState}
        readOnly={readOnly}
        onChange={setInternal}
      />

      {descriptor && descriptor.inputs.length > 0 ? (
        <Section title="Inputs">
          {descriptor.inputs
            .filter((i) => i.isBrowsable !== false)
            .map((input) => (
              <PersistenceRow
                key={input.name}
                label={input.displayName ?? input.name}
                value={config.inputs?.[input.name]}
                readOnly={readOnly}
                onChange={(next) => setInput(input.name, next)}
              />
            ))}
        </Section>
      ) : null}

      {descriptor && descriptor.outputs.length > 0 ? (
        <Section title="Outputs">
          {descriptor.outputs
            .filter((o) => o.isBrowsable !== false)
            .map((output) => (
              <PersistenceRow
                key={output.name}
                label={output.displayName ?? output.name}
                value={config.outputs?.[output.name]}
                readOnly={readOnly}
                onChange={(next) => setOutput(output.name, next)}
              />
            ))}
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="hover:bg-muted/50 flex w-full items-center gap-1 px-2 py-1.5 text-left text-xs font-medium uppercase tracking-wide"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {title}
      </button>
      {open ? <div className="flex flex-col gap-3 border-t p-2">{children}</div> : null}
    </div>
  );
}

function PersistenceRow({
  label,
  helper,
  value,
  readOnly,
  onChange,
}: {
  label: string;
  helper?: string;
  value: SinglePersistenceConfig | undefined;
  readOnly: boolean;
  onChange: (next: SinglePersistenceConfig) => void;
}) {
  const mode: Mode = ((value?.strategyType as Mode | undefined) ?? INHERIT) as Mode;
  const expressionValue = typeof value?.expression?.value === "string" ? value.expression.value : "";
  const expressionType = value?.expression?.type ?? "JavaScript";

  const onModeChange = (m: string | null) => {
    if (!m) return;
    if (m === INHERIT) {
      onChange({ strategyType: null, expression: null });
    } else if (m === "Expression") {
      onChange({
        strategyType: "Expression",
        expression: { type: expressionType, value: expressionValue },
      });
    } else {
      onChange({ strategyType: m, expression: null });
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        <Select value={mode} onValueChange={onModeChange} disabled={readOnly}>
          <SelectTrigger size="sm" className="ml-auto w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {helper ? (
        <p className="text-muted-foreground text-xs">{helper}</p>
      ) : null}
      {mode === "Expression" ? (
        <div className="overflow-hidden rounded-md border">
          <MonacoCodeEditor
            value={expressionValue}
            language="javascript"
            readOnly={readOnly}
            height={80}
            onChange={(v) =>
              onChange({
                strategyType: "Expression",
                expression: { type: expressionType, value: v },
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function configHasContent(cfg: SinglePersistenceConfig): boolean {
  if (cfg.strategyType) return true;
  if (cfg.expression && (cfg.expression.value ?? "").length > 0) return true;
  return false;
}
