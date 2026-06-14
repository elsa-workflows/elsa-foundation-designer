"use client";

import { format } from "date-fns";
import { GitBranch } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionCard } from "@/features/workflows/activity-properties/section-card";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import { useWorkflowDefinitionVersions } from "@/lib/api/elsa";
import type { ActivityJson } from "@/lib/api/types";

/**
 * "Pin a sub-workflow to a specific version" card. Mirrors Blazor's
 * `VersionTab.razor`. Surfaces only when the selected activity has the
 * `workflowDefinitionId` field, which is how activities derived from
 * `WorkflowDefinitionActivity` reference the workflow they invoke.
 *
 * Persists three fields back onto the activity:
 *   - `workflowDefinitionId` (unchanged here, we never rewrite the target)
 *   - `workflowDefinitionVersionId` (the picked version's row id)
 *   - `version` (the picked version number)
 */
export function WorkflowVersionCard({ activity }: { activity: ActivityJson }) {
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);

  const props = activity as Record<string, unknown>;
  const workflowDefinitionId = (props.workflowDefinitionId as string | undefined) ?? "";
  const versionId = (props.workflowDefinitionVersionId as string | undefined) ?? "";
  const version = (props.version as number | undefined) ?? null;

  const versions = useWorkflowDefinitionVersions(workflowDefinitionId || undefined);
  const items = useMemo(() => versions.data?.items ?? [], [versions.data?.items]);

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.version - a.version),
    [items],
  );

  // value → label map so `<SelectValue />` shows e.g. "v3 · Published" instead
  // of the raw version row id.
  const itemsMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const v of sorted) {
      map[v.id] = `v${v.version} · ${v.isPublished ? "Published" : "Draft"}`;
    }
    return map;
  }, [sorted]);

  const onPick = (nextVersionId: string | null) => {
    if (!root || !nextVersionId) return;
    const picked = items.find((v) => v.id === nextVersionId);
    if (!picked) return;
    setRoot(
      updateActivity(root, activity.id, (a) => {
        const next = { ...a } as Record<string, unknown>;
        next.workflowDefinitionVersionId = picked.id;
        next.version = picked.version;
        return next as ActivityJson;
      }),
    );
  };

  return (
    <SectionCard
      title="Workflow version"
      helper="Pin which version of the referenced workflow runs here."
      Icon={GitBranch}
      tone="sky"
      defaultOpen
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="wfv-version" className="text-xs font-medium">
          Version
        </Label>
        <Select
          items={itemsMap}
          value={versionId || ""}
          onValueChange={onPick}
          disabled={readOnly || versions.isPending || items.length === 0}
        >
          <SelectTrigger size="sm" id="wfv-version">
            <SelectValue
              placeholder={
                versions.isPending
                  ? "Loading versions…"
                  : items.length === 0
                  ? "No versions"
                  : "Pick a version"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {sorted.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                <span className="tabular-nums">v{v.version}</span>
                {v.isPublished ? (
                  <Badge className="ml-2 font-normal" variant="default">
                    Published
                  </Badge>
                ) : (
                  <Badge className="ml-2 font-normal" variant="outline">
                    Draft
                  </Badge>
                )}
                <span className="text-muted-foreground ml-2 text-xs">
                  {format(new Date(v.createdAt), "yyyy-MM-dd HH:mm")}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {version != null ? (
          <p className="text-muted-foreground text-xs leading-relaxed">
            Currently invoking <span className="tabular-nums">v{version}</span>
            {workflowDefinitionId ? (
              <>
                {" "}
                of <span className="font-mono">{workflowDefinitionId.slice(0, 8)}</span>
              </>
            ) : null}
            .
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

/** True if the activity has a `workflowDefinitionId` — the marker for
 * `WorkflowDefinitionActivity` descendants. */
export function isWorkflowDefinitionActivity(activity: ActivityJson): boolean {
  const props = activity as Record<string, unknown>;
  return typeof props.workflowDefinitionId === "string" && props.workflowDefinitionId.length > 0;
}
