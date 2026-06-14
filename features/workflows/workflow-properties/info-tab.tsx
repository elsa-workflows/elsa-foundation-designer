"use client";

import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MarkdownTextarea } from "@/components/ui/markdown-textarea";
import { useEditorStore } from "@/features/workflows/editor-store";
import { LabelsPicker } from "@/features/workflows/labels-picker";
import {
  useActivationStrategies,
  useIncidentStrategies,
  useLogPersistenceStrategies,
  useWorkflowCommitStrategies,
} from "@/lib/api/elsa";

const NONE_VALUE = "__none";

/**
 * Workflow-level metadata + info + settings — mirrors Blazor's Metadata + Info
 * + Settings sections under the Properties tab. The Settings section pulls
 * strategy descriptors from the backend and lets the user pick activation /
 * incident / commit / log-persistence strategies; toggling `usableAsActivity`
 * reveals two extra fields (auto-update consumers + activity category).
 */
export function InfoTab() {
  const definition = useEditorStore((s) => s.definition);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  const activationStrategies = useActivationStrategies();
  const incidentStrategies = useIncidentStrategies();
  const commitStrategies = useWorkflowCommitStrategies();
  const logPersistenceStrategies = useLogPersistenceStrategies();

  // Value → label maps so base-ui's `<SelectValue />` resolves the friendly
  // strategy name in the trigger instead of the raw sentinel / typeName.
  const activationItems = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { [NONE_VALUE]: "Default" };
    for (const s of activationStrategies.data ?? []) map[s.typeName] = s.displayName;
    return map;
  }, [activationStrategies.data]);
  const incidentItems = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { [NONE_VALUE]: "Default" };
    for (const s of incidentStrategies.data ?? []) map[s.typeName] = s.displayName;
    return map;
  }, [incidentStrategies.data]);
  const commitItems = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { [NONE_VALUE]: "Default" };
    for (const s of commitStrategies.data ?? []) map[s.name] = s.displayName;
    return map;
  }, [commitStrategies.data]);
  const logPersistenceItems = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { [NONE_VALUE]: "Default" };
    for (const s of logPersistenceStrategies.data ?? []) map[s.typeName] = s.displayName;
    return map;
  }, [logPersistenceStrategies.data]);

  if (!definition) return null;
  const readOnly = !!definition.isReadonly;

  // Convenience: read/write a key on `options`.
  const options = (definition.options ?? {}) as Record<string, unknown>;
  const setOption = (key: string, value: unknown) =>
    setDefinition((prev) => ({
      ...prev,
      options: {
        ...((prev.options ?? {}) as Record<string, unknown>),
        [key]: value === null || value === "" ? null : value,
      },
    }));

  const usableAsActivity = options.usableAsActivity === true;
  const activationStrategy = (options.activationStrategyType as string | undefined) ?? NONE_VALUE;
  const incidentStrategy = (options.incidentStrategyType as string | undefined) ?? NONE_VALUE;
  const commitStrategy = (options.commitStrategyName as string | undefined) ?? NONE_VALUE;
  const logPersistenceMode = (options.logPersistenceMode as string | undefined) ?? NONE_VALUE;
  const usePersistentVariables = options.usePersistentVariables === true;
  const autoUpdateConsumers = options.autoUpdateConsumingWorkflows === true;
  const activityCategory = (options.activityCategory as string | undefined) ?? "";
  const labelIds = (definition.labelIds ?? []) as string[];

  const activationDescription = activationStrategies.data?.find(
    (s) => s.typeName === activationStrategy,
  )?.description;
  const logPersistenceDescription = logPersistenceStrategies.data?.find(
    (s) => s.typeName === logPersistenceMode,
  )?.description;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      {/* Metadata */}
      <section className="flex flex-col gap-3">
        <SectionHeader>Metadata</SectionHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="wf-name">Name</Label>
          <Input
            id="wf-name"
            value={definition.name ?? ""}
            onChange={(e) => setDefinition((prev) => ({ ...prev, name: e.target.value }))}
            readOnly={readOnly}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="wf-desc">Description</Label>
          <MarkdownTextarea
            id="wf-desc"
            value={definition.description ?? ""}
            onChange={(next) => setDefinition((prev) => ({ ...prev, description: next }))}
            readOnly={readOnly}
            rows={5}
            placeholder="Markdown supported"
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Labels</Label>
          <LabelsPicker
            value={labelIds}
            onChange={(ids) =>
              setDefinition((prev) => ({ ...prev, labelIds: ids.length > 0 ? ids : [] }))
            }
            disabled={readOnly}
          />
        </div>
      </section>

      {/* Custom properties — free-form key/value pairs on definition.customProperties */}
      <CustomPropertiesSection />

      {/* Info — read-only metadata */}
      <section className="flex flex-col gap-2">
        <SectionHeader>Info</SectionHeader>
        <InfoRow label="Definition id" value={<span className="font-mono">{definition.definitionId}</span>} />
        {definition.id ? (
          <InfoRow label="Version id" value={<span className="font-mono">{definition.id}</span>} />
        ) : null}
        <InfoRow label="Version" value={<span className="tabular-nums">v{definition.version}</span>} />
        <InfoRow
          label="Status"
          value={
            <Badge variant={definition.isPublished ? "default" : "outline"} className="font-normal">
              {definition.isPublished ? "Published" : "Draft"}
            </Badge>
          }
        />
        <InfoRow
          label="Read-only"
          value={
            <Badge variant="outline" className="font-normal">
              {readOnly ? "Yes" : "No"}
            </Badge>
          }
        />
        {definition.createdAt ? (
          <InfoRow label="Created" value={format(new Date(definition.createdAt), "yyyy-MM-dd HH:mm")} />
        ) : null}
      </section>

      {/* Settings */}
      <section className="flex flex-col gap-3">
        <SectionHeader>Settings</SectionHeader>

        <div className="grid gap-1.5">
          <Label htmlFor="wf-activation">Activation strategy</Label>
          <Select
            items={activationItems}
            value={activationStrategy}
            onValueChange={(v) =>
              setOption("activationStrategyType", !v || v === NONE_VALUE ? null : v)
            }
            disabled={readOnly}
          >
            <SelectTrigger id="wf-activation" size="sm">
              <SelectValue placeholder={activationStrategies.isPending ? "Loading…" : "Default"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Default</SelectItem>
              {(activationStrategies.data ?? []).map((s) => (
                <SelectItem key={s.typeName} value={s.typeName}>
                  {s.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {activationDescription ??
              "How the workflow activates when a trigger fires (e.g. always start a new instance, or correlate with an existing one)."}
          </p>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="wf-incident">Incident handling strategy</Label>
          <Select
            items={incidentItems}
            value={incidentStrategy}
            onValueChange={(v) =>
              setOption("incidentStrategyType", !v || v === NONE_VALUE ? null : v)
            }
            disabled={readOnly}
          >
            <SelectTrigger id="wf-incident" size="sm">
              <SelectValue placeholder={incidentStrategies.isPending ? "Loading…" : "Default"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Default</SelectItem>
              {(incidentStrategies.data ?? []).map((s) => (
                <SelectItem key={s.typeName} value={s.typeName}>
                  {s.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="wf-commit">Commit strategy</Label>
          <Select
            items={commitItems}
            value={commitStrategy}
            onValueChange={(v) =>
              setOption("commitStrategyName", !v || v === NONE_VALUE ? null : v)
            }
            disabled={readOnly}
          >
            <SelectTrigger id="wf-commit" size="sm">
              <SelectValue placeholder={commitStrategies.isPending ? "Loading…" : "Default"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Default</SelectItem>
              {(commitStrategies.data ?? []).map((s) => (
                <SelectItem key={s.name} value={s.name}>
                  {s.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="wf-log">Log persistence strategy</Label>
          <Select
            items={logPersistenceItems}
            value={logPersistenceMode}
            onValueChange={(v) =>
              setOption("logPersistenceMode", !v || v === NONE_VALUE ? null : v)
            }
            disabled={readOnly}
          >
            <SelectTrigger id="wf-log" size="sm">
              <SelectValue placeholder={logPersistenceStrategies.isPending ? "Loading…" : "Default"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Default</SelectItem>
              {(logPersistenceStrategies.data ?? []).map((s) => (
                <SelectItem key={s.typeName} value={s.typeName}>
                  {s.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {logPersistenceDescription ? (
            <p className="text-muted-foreground text-xs leading-relaxed">
              {logPersistenceDescription}
            </p>
          ) : null}
        </div>

        <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
          <Checkbox
            checked={usePersistentVariables}
            disabled={readOnly}
            onCheckedChange={(c) => setOption("usePersistentVariables", !!c)}
          />
          <span className="flex flex-col">
            <span>Use persistent variables</span>
            <span className="text-muted-foreground text-xs leading-relaxed">
              Persist variable values across executions so resumed workflows can read them.
            </span>
          </span>
        </Label>

        <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
          <Checkbox
            checked={usableAsActivity}
            disabled={readOnly}
            onCheckedChange={(c) => setOption("usableAsActivity", !!c)}
          />
          Use this workflow as an activity in other workflows
        </Label>

        {usableAsActivity ? (
          <div className="ml-6 flex flex-col gap-3 border-l pl-3">
            <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
              <Checkbox
                checked={autoUpdateConsumers}
                disabled={readOnly}
                onCheckedChange={(c) => setOption("autoUpdateConsumingWorkflows", !!c)}
              />
              Auto-update consuming workflows when this is republished
            </Label>
            <div className="grid gap-1.5">
              <Label htmlFor="wf-activity-cat">Activity category</Label>
              <Input
                id="wf-activity-cat"
                value={activityCategory}
                onChange={(e) => setOption("activityCategory", e.target.value)}
                readOnly={readOnly}
                placeholder="Used in the activity palette"
              />
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground text-2xs font-medium uppercase tracking-wide">
      {children}
    </h3>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[max-content_1fr] gap-x-3 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * Editor for `definition.customProperties`. The underlying type is
 * `Record<string, unknown>` but the UI treats it as ordered key/value strings.
 *
 * Non-string values that come from the wire (numbers, booleans, objects) are
 * rendered as their JSON form so the user can edit them; on save we attempt to
 * parse JSON back, falling back to the raw string if parsing fails. This keeps
 * round-trips lossless for primitive values while still supporting structured
 * values via JSON.
 *
 * The local state holds rows including blank/duplicate keys so the user can
 * type freely; the materialised map only includes rows with a non-empty key,
 * and later rows with duplicate keys win (matches a top-to-bottom mental model).
 */
function CustomPropertiesSection() {
  const customProperties = useEditorStore((s) => s.definition?.customProperties);
  const setDefinition = useEditorStore((s) => s.setDefinition);
  const readOnly = useEditorStore((s) => !!s.definition?.isReadonly);

  // Local order-preserving mirror. Re-synced from upstream whenever the
  // materialised form drifts (e.g. after a save/hydrate brings new keys in)
  // and the user isn't mid-edit on a blank-key row.
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>(() =>
    customPropertiesToRows(customProperties),
  );
  const lastCommittedSig = useRef(JSON.stringify(rowsToCustomProperties(rows)));

  useEffect(() => {
    const upstreamSig = JSON.stringify(customProperties ?? {});
    if (upstreamSig === lastCommittedSig.current) return;
    // The upstream object changed without going through us — re-sync.
    lastCommittedSig.current = upstreamSig;
    setRows(customPropertiesToRows(customProperties));
  }, [customProperties]);

  const commit = (next: Array<{ key: string; value: string }>) => {
    setRows(next);
    const map = rowsToCustomProperties(next);
    lastCommittedSig.current = JSON.stringify(map);
    setDefinition((prev) => ({ ...prev, customProperties: map }));
  };

  const updateRow = (i: number, patch: Partial<{ key: string; value: string }>) =>
    commit(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => commit(rows.filter((_, idx) => idx !== i));
  const addRow = () => commit([...rows, { key: "", value: "" }]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <SectionHeader>Custom properties</SectionHeader>
        <Button size="xs" variant="outline" onClick={addRow} disabled={readOnly}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">No custom properties.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-[1fr_2fr_auto] items-center gap-1.5">
              <Input
                value={row.key}
                placeholder="Key"
                onChange={(e) => updateRow(i, { key: e.target.value })}
                readOnly={readOnly}
              />
              <Input
                value={row.value}
                placeholder="Value (string or JSON)"
                onChange={(e) => updateRow(i, { value: e.target.value })}
                readOnly={readOnly}
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Delete ${row.key || "row"}`}
                onClick={() => removeRow(i)}
                disabled={readOnly}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function customPropertiesToRows(
  cp: Record<string, unknown> | undefined,
): Array<{ key: string; value: string }> {
  if (!cp) return [];
  return Object.entries(cp).map(([key, value]) => ({
    key,
    value: typeof value === "string" ? value : JSON.stringify(value),
  }));
}

function rowsToCustomProperties(
  rows: Array<{ key: string; value: string }>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    if (key === "") continue;
    out[key] = tryParseJsonScalar(value);
  }
  return out;
}

/**
 * Best-effort: parse `value` as JSON when it looks like a number/boolean/null/
 * object/array; otherwise keep it as a raw string. This mirrors what a YAML
 * scalar parser would do and keeps the round-trip with the backend lossless
 * for primitive values.
 */
function tryParseJsonScalar(value: string): unknown {
  if (value === "") return "";
  const trimmed = value.trim();
  const isLikelyJson =
    trimmed === "true" ||
    trimmed === "false" ||
    trimmed === "null" ||
    /^-?\d+(\.\d+)?$/.test(trimmed) ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[") ||
    trimmed.startsWith('"');
  if (!isLikelyJson) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}
