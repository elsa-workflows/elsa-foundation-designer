"use client";

import { useMemo } from "react";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getCustomProperty,
  setCustomProperty,
} from "@/features/workflows/activity-properties/custom-props";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import { useActivityCommitStrategies } from "@/lib/api/elsa";
import type { ActivityJson } from "@/lib/api/types";

const DEFAULT_VALUE = "__default";

/**
 * Picks the activity's commit strategy. Stored at
 * `customProperties.commitStrategyName` (mirrors the Blazor extension
 * `Activity.GetCommitStrategy/SetCommitStrategy`).
 */
export function ActivityCommitStrategyTab({ activity }: { activity: ActivityJson }) {
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);
  const strategies = useActivityCommitStrategies();

  const current = getCustomProperty<string>(activity, "commitStrategyName") ?? DEFAULT_VALUE;

  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { [DEFAULT_VALUE]: "Default" };
    for (const s of strategies.data ?? []) map[s.name] = s.displayName;
    return map;
  }, [strategies.data]);

  const onChange = (value: string | null) => {
    if (!root) return;
    const next = !value || value === DEFAULT_VALUE ? null : value;
    setRoot(updateActivity(root, activity.id, (a) => setCustomProperty(a, "commitStrategyName", next)));
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium">Commit strategy</Label>
      <Select items={items} value={current} onValueChange={onChange} disabled={readOnly}>
        <SelectTrigger size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_VALUE}>Default</SelectItem>
          {(strategies.data ?? []).map((s) => (
            <SelectItem key={s.name} value={s.name}>
              {s.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">
        Controls when the workflow state is committed for this activity. Leave on
        Default to inherit the workflow-level strategy.
      </p>
      {strategies.isError ? (
        <p className="text-destructive text-xs">
          Couldn&apos;t load commit strategies from the server.
        </p>
      ) : null}
    </div>
  );
}
