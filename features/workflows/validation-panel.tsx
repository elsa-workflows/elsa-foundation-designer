"use client";

import { AlertTriangle, ChevronDown, ChevronUp, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  findActivityById,
  useEditorStore,
} from "@/features/workflows/editor-store";
import { validateStateMachineRoot } from "@/features/workflows/validate-state-machine";

/**
 * Sticky strip rendered below the canvas showing the most recent
 * `ValidationErrors` from a failed save/publish. The errors clear automatically
 * on the next successful save/publish or when the user dismisses the panel.
 *
 * Clicking an error whose path mentions an activity id (Elsa emits paths like
 * `Root.Activities[<id>].Inputs.Foo`) selects that activity and pops the
 * container stack back to the root. Best-effort navigation: if the id refers
 * to an activity nested inside an embedded port we leave the user on the root
 * canvas — the selection still flips the right panel to the right activity.
 */
export function ValidationPanel() {
  const errors = useEditorStore((s) => s.validationErrors);
  const clearValidationErrors = useEditorStore((s) => s.clearValidationErrors);
  const definitionRoot = useEditorStore((s) => s.definition?.root);
  const setSelectedActivityId = useEditorStore((s) => s.setSelectedActivityId);
  const popToContainer = useEditorStore((s) => s.popToContainer);
  const [collapsed, setCollapsed] = useState(false);

  // Server-side errors (from the last failed save/publish).
  const serverRows = useMemo(() => flattenErrors(errors), [errors]);
  // Local State-Machine validator — runs on every root change. Issues here
  // are advisory until the user attempts to save; we surface them alongside
  // the server errors so users get fast feedback while editing.
  const smRows = useMemo(() => {
    if (!definitionRoot) return [];
    return validateStateMachineRoot(definitionRoot).map((issue) => ({
      path: issue.target ?? issue.code,
      message: issue.message,
      severity: issue.severity,
    }));
  }, [definitionRoot]);
  const rows = useMemo(
    () => [
      ...serverRows.map((r) => ({ ...r, severity: "error" as const })),
      ...smRows,
    ],
    [serverRows, smRows],
  );
  if (rows.length === 0) return null;

  const errorCount = rows.filter((r) => r.severity === "error").length;
  const warningCount = rows.length - errorCount;
  const onlyWarnings = errorCount === 0 && warningCount > 0;

  const onJumpTo = (path: string) => {
    const id = extractActivityId(path);
    if (!id || !definitionRoot) return;
    const hit = findActivityById(definitionRoot, id);
    if (!hit) return;
    popToContainer(-1);
    setSelectedActivityId(id);
  };

  // When the panel only carries warnings (typical State-Machine live-edit
  // case) we tint amber instead of destructive-red so it doesn't feel like
  // a blocking failure.
  const tone = onlyWarnings ? "amber" : "destructive";
  return (
    <div
      className={
        tone === "destructive" ? "border-t bg-destructive/5" : "border-t bg-amber-500/5"
      }
    >
      <div
        className={
          tone === "destructive"
            ? "flex items-center gap-2 border-b border-destructive/20 px-3 py-1.5"
            : "flex items-center gap-2 border-b border-amber-500/30 px-3 py-1.5"
        }
      >
        <AlertTriangle
          className={
            tone === "destructive"
              ? "size-3.5 text-destructive"
              : "size-3.5 text-amber-600 dark:text-amber-400"
          }
          aria-hidden
        />
        <span
          className={
            tone === "destructive"
              ? "text-xs font-medium text-destructive"
              : "text-xs font-medium text-amber-700 dark:text-amber-300"
          }
        >
          {onlyWarnings
            ? `${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`
            : errorCount > 0 && warningCount > 0
              ? `${errorCount} ${errorCount === 1 ? "error" : "errors"}, ${warningCount} ${warningCount === 1 ? "warning" : "warnings"}`
              : `Validation failed — ${rows.length} ${rows.length === 1 ? "issue" : "issues"}`}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={collapsed ? "Expand validation issues" : "Collapse validation issues"}
          className="ml-auto"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </Button>
        {/* Server-side errors are dismissible; local SM warnings reappear on
            the next edit, so a dismiss button there would be misleading. */}
        {serverRows.length > 0 ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss server validation errors"
            onClick={clearValidationErrors}
          >
            <X className="size-3.5" />
          </Button>
        ) : null}
      </div>
      {!collapsed ? (
        <ul
          className={
            tone === "destructive"
              ? "max-h-40 divide-y divide-destructive/10 overflow-y-auto"
              : "max-h-40 divide-y divide-amber-500/15 overflow-y-auto"
          }
        >
          {rows.map((row, i) => {
            const activityId = extractActivityId(row.path);
            const jumpable = !!activityId && !!definitionRoot && !!findActivityById(definitionRoot, activityId);
            return (
              <li key={`${row.path}:${i}`} className="px-3 py-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => jumpable && onJumpTo(row.path)}
                  disabled={!jumpable}
                  className={
                    jumpable
                      ? "group flex w-full items-baseline gap-2 text-left hover:text-destructive"
                      : "flex w-full cursor-default items-baseline gap-2 text-left"
                  }
                  title={jumpable ? "Jump to activity" : undefined}
                >
                  {row.severity === "warning" ? (
                    <span
                      aria-hidden
                      className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-amber-500"
                      title="Warning"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="mt-1 inline-block size-1.5 shrink-0 rounded-full bg-rose-500"
                      title="Error"
                    />
                  )}
                  <code
                    className={
                      jumpable
                        ? "text-muted-foreground font-mono text-xs group-hover:text-destructive"
                        : "text-muted-foreground font-mono text-xs"
                    }
                  >
                    {row.path}
                  </code>
                  <span className="text-foreground">{row.message}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function flattenErrors(
  errors: Record<string, string[]> | null | undefined,
): Array<{ path: string; message: string }> {
  if (!errors) return [];
  const out: Array<{ path: string; message: string }> = [];
  for (const [path, messages] of Object.entries(errors)) {
    for (const message of messages) out.push({ path, message });
  }
  return out;
}

/**
 * Pull an activity id out of a server-emitted field path like
 * `Root.Activities[<id>].Inputs.Foo`. Returns null when the path doesn't
 * mention an activity (e.g. workflow-level fields like `Variables[0].Name`).
 */
function extractActivityId(path: string): string | null {
  const match = /Activities\[([^\]]+)\]/.exec(path);
  if (!match) return null;
  const raw = match[1].trim();
  // Numeric index (e.g. legacy "Activities[0]") — we can't resolve those
  // without an ordered child walk so bail; the caller will leave the row
  // un-clickable.
  if (/^\d+$/.test(raw)) return null;
  // Strip surrounding quotes that some server versions add around string ids.
  return raw.replace(/^"|"$/g, "");
}
