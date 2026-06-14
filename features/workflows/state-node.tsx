"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Flag, LogIn, LogOut, MoreVertical, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StateMachineNodeData } from "@/features/workflows/build-state-machine-graph";
import { useEditorStore } from "@/features/workflows/editor-store";

/**
 * Render of a single State Machine state. Click selects (drives the
 * properties panel); drag repositions; kebab menu offers "Set as initial",
 * "Rename…", "Delete state". Inline rename mode replaces the title with a
 * focused input — Enter commits, Escape cancels.
 *
 * The pill at the bottom shows quick-glance badges so a user can see which
 * state is initial / current / terminal without clicking through.
 */
export function StateNode({ data, selected }: NodeProps) {
  const d = data as StateMachineNodeData;
  const isCurrent = d.isCurrent;
  const isInitial = d.isInitial;
  const isTerminal = d.isTerminal;
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);
  const setStateMachineInitialState = useEditorStore(
    (s) => s.setStateMachineInitialState,
  );
  const renameStateMachineState = useEditorStore(
    (s) => s.renameStateMachineState,
  );
  const removeStateMachineState = useEditorStore(
    (s) => s.removeStateMachineState,
  );

  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(d.name);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // When the persisted name changes (e.g. after rename / undo), sync the
  // draft so the next rename starts from the current value.
  useEffect(() => {
    if (!renaming) setDraft(d.name);
  }, [d.name, renaming]);

  // Focus the input when entering rename mode.
  useEffect(() => {
    if (renaming) requestAnimationFrame(() => inputRef.current?.select());
  }, [renaming]);

  const startRename = () => {
    setDraft(d.name);
    setRenaming(true);
  };
  const commitRename = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== d.name) renameStateMachineState(d.name, trimmed);
    setRenaming(false);
  };
  const cancelRename = () => {
    setDraft(d.name);
    setRenaming(false);
  };

  const ringClass = selected
    ? "ring-2 ring-primary"
    : isCurrent
      ? "ring-2 ring-emerald-500"
      : "";

  return (
    <div
      className={[
        "group/state bg-card border-border relative flex min-w-[180px] flex-col rounded-md border shadow-sm",
        ringClass,
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2.5 !border !border-border !bg-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2.5 !border !border-border !bg-background"
      />

      <div className="flex items-start gap-2 px-3 py-2">
        {isInitial ? (
          <span
            className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 mt-0.5 rounded p-0.5"
            title="Initial state"
          >
            <Flag className="size-3" />
          </span>
        ) : isTerminal ? (
          <span
            className="bg-muted text-muted-foreground mt-0.5 rounded p-0.5"
            title="Terminal state"
          >
            <Square className="size-3" />
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          {renaming ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              onBlur={commitRename}
              className="border-input bg-background w-full rounded-sm border px-1 py-0.5 text-sm font-medium leading-tight outline-none focus-visible:border-primary"
            />
          ) : (
            <span
              className="truncate text-sm font-medium leading-tight"
              onDoubleClick={(e) => {
                if (readOnly) return;
                e.stopPropagation();
                startRename();
              }}
              title={readOnly ? d.name : "Double-click to rename"}
            >
              {d.name}
            </span>
          )}
          {d.description ? (
            <span className="text-muted-foreground line-clamp-2 text-xs leading-snug">
              {d.description}
            </span>
          ) : null}
        </div>
        {!readOnly && !renaming ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`State actions for ${d.name}`}
                  className="opacity-0 transition-opacity group-hover/state:opacity-100 data-popup-open:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreVertical className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={isInitial}
                onSelect={() => setStateMachineInitialState(d.name)}
              >
                <Flag className="size-3.5" /> Set as initial
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={startRename}>
                Rename…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => removeStateMachineState(d.name)}
              >
                <Trash2 className="size-3.5" /> Delete state
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="border-border/60 flex items-center gap-1 border-t bg-muted/30 px-2 py-1">
        {isInitial ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 py-0 text-2xs">
            Initial
          </Badge>
        ) : null}
        {isCurrent && !isInitial ? (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 py-0 text-2xs">
            Current
          </Badge>
        ) : null}
        {isTerminal ? (
          <Badge variant="outline" className="text-muted-foreground py-0 text-2xs">
            Terminal
          </Badge>
        ) : null}
        {d.hasEntry ? (
          <span
            className="text-muted-foreground inline-flex items-center gap-0.5 text-2xs"
            title="Has entry action"
          >
            <LogIn className="size-2.5" /> entry
          </span>
        ) : null}
        {d.hasExit ? (
          <span
            className="text-muted-foreground inline-flex items-center gap-0.5 text-2xs"
            title="Has exit action"
          >
            <LogOut className="size-2.5" /> exit
          </span>
        ) : null}
      </div>
    </div>
  );
}
