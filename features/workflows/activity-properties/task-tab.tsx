"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  getCustomProperty,
  setCustomProperty,
} from "@/features/workflows/activity-properties/custom-props";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import type { ActivityJson } from "@/lib/api/types";

/**
 * Task-kind activities run as background work. The only knob in this pane is
 * whether that work runs asynchronously. Stored at
 * `customProperties.runAsynchronously` to mirror Blazor `Activity.SetRunAsynchronously`.
 *
 * Gated by the caller — the panel only mounts this tab when
 * `descriptor.kind === "Task"`.
 */
export function ActivityTaskTab({ activity }: { activity: ActivityJson }) {
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);

  const runAsync = getCustomProperty<boolean>(activity, "runAsynchronously") === true;

  const onChange = (next: boolean) => {
    if (!root) return;
    setRoot(
      updateActivity(root, activity.id, (a) =>
        setCustomProperty(a, "runAsynchronously", next ? true : null),
      ),
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Label className="flex cursor-pointer items-start gap-2 text-xs font-normal">
        <Checkbox
          checked={runAsync}
          disabled={readOnly}
          onCheckedChange={(c) => onChange(!!c)}
          className="mt-0.5"
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">Run asynchronously</span>
          <span className="text-muted-foreground text-xs">
            When checked, the task runs in the background and the workflow
            continues without waiting for completion.
          </span>
        </span>
      </Label>
    </div>
  );
}
