"use client";

import { useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MarkdownTextarea } from "@/components/ui/markdown-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type { ActivityJson } from "@/lib/api/types";

const MERGE_MODES = ["WaitAll", "WaitAny", "Race"] as const;

/**
 * Fields mirrored from the Blazor CommonTab:
 *   - id (Name)
 *   - metadata.displayText (Display text)
 *   - metadata.description (Description, markdown — plain textarea in this port)
 *   - metadata.showDescription (Show description toggle)
 *   - canStartWorkflow (Trigger workflow / Start of workflow, label depends on Kind)
 *   - mergeMode (only for join-style activities)
 */
export function ActivityCommonTab({ activity }: { activity: ActivityJson }) {
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);
  const descriptors = useActivityDescriptors();

  const descriptor = useMemo(
    () => descriptors.data?.find((d) => d.typeName === activity.type) ?? null,
    [descriptors.data, activity.type],
  );

  const isTrigger = descriptor?.kind === "Trigger";
  // FlowJoin is itself a join activity; merge-mode toggles are pointless there.
  const showMergeMode = !activity.type.endsWith(".FlowJoin");

  const displayText = (activity.metadata?.displayText as string | undefined) ?? "";
  const description = (activity.metadata?.description as string | undefined) ?? "";
  const showDescription = (activity.metadata?.showDescription as boolean | undefined) ?? false;
  const canStartWorkflow = (activity.canStartWorkflow as boolean | undefined) ?? false;
  const mergeMode = (activity.mergeMode as string | undefined) ?? "WaitAll";

  const setActivityProp = (mutator: (a: ActivityJson) => ActivityJson) => {
    if (!root) return;
    setRoot(updateActivity(root, activity.id, mutator));
  };

  const setMetadata = (key: string, value: unknown) =>
    setActivityProp((a) => ({
      ...a,
      metadata: { ...(a.metadata ?? {}), [key]: value === "" ? undefined : value },
    }));

  const setTopLevel = (key: string, value: unknown) =>
    setActivityProp((a) => {
      const next = { ...a } as Record<string, unknown>;
      if (value === undefined || value === null) delete next[key];
      else next[key] = value;
      return next as ActivityJson;
    });

  // Renaming the id is destructive: any edge keyed by the old id must follow.
  const renameId = (nextId: string) => {
    if (!root || !nextId || nextId === activity.id) return;
    setActivityProp((a) => ({ ...a, id: nextId }));
    // Re-key any connections that referenced the old id.
    if (Array.isArray(root.connections)) {
      const oldId = activity.id;
      const nextConnections = root.connections.map((c) => ({
        source: c.source.activity === oldId ? { ...c.source, activity: nextId } : c.source,
        target: c.target.activity === oldId ? { ...c.target, activity: nextId } : c.target,
        vertices: c.vertices,
      }));
      setRoot({ ...root, connections: nextConnections });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ca-name" className="text-xs font-medium">
          Name
        </Label>
        <Input
          id="ca-name"
          value={activity.id}
          readOnly={readOnly}
          onBlur={(e) => renameId(e.target.value.trim())}
          onChange={(e) => setActivityProp((a) => ({ ...a, id: e.target.value }))}
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Activity identifier. Connections re-target automatically when you rename.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ca-display" className="text-xs font-medium">
          Display text
        </Label>
        <Input
          id="ca-display"
          value={displayText}
          readOnly={readOnly}
          placeholder="Shown on the canvas node"
          onChange={(e) => setMetadata("displayText", e.target.value)}
        />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ca-description" className="text-xs font-medium">
          Description
        </Label>
        <MarkdownTextarea
          id="ca-description"
          value={description}
          readOnly={readOnly}
          rows={4}
          placeholder="Markdown supported"
          onChange={(next) => setMetadata("description", next)}
        />
        <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
          <Checkbox
            checked={showDescription}
            disabled={readOnly}
            onCheckedChange={(c) => setMetadata("showDescription", c)}
          />
          Show description on the canvas
        </Label>
      </div>

      <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
        <Checkbox
          checked={canStartWorkflow}
          disabled={readOnly}
          onCheckedChange={(c) => setTopLevel("canStartWorkflow", c)}
        />
        {isTrigger ? "Trigger workflow" : "Start of workflow"}
      </Label>

      {showMergeMode ? (
        <div className="grid gap-1.5">
          <Label htmlFor="ca-merge" className="text-xs font-medium">
            Merge mode
          </Label>
          <Select
            value={mergeMode}
            onValueChange={(v) => v && setTopLevel("mergeMode", v)}
            disabled={readOnly}
          >
            <SelectTrigger size="sm" id="ca-merge">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MERGE_MODES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs leading-relaxed">
            How this activity merges signals from inbound connections.
          </p>
        </div>
      ) : null}
    </div>
  );
}
