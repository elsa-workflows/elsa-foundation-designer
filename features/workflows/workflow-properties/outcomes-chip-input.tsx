"use client";

import { GripVertical, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  readOnly?: boolean;
  placeholder?: string;
};

/**
 * Chip-style editor for a `string[]` — the workflow's outcomes. Mirrors
 * MudChipField from the Blazor studio:
 *   - Type a value + Enter (or comma) to add a chip.
 *   - Backspace on an empty field deletes the last chip.
 *   - Click `×` to remove a specific chip.
 *   - Drag a chip via its grip handle to reorder.
 *
 * Read-only state hides all add / remove / drag affordances and falls
 * back to plain badges.
 */
export function OutcomesChipInput({ value, onChange, readOnly, placeholder }: Props) {
  const [draft, setDraft] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (readOnly) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    const next = value.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      onClick={(e) => {
        // Click anywhere on the field area focuses the input.
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "BUTTON") {
          const inp = (e.currentTarget as HTMLElement).querySelector("input");
          inp?.focus();
        }
      }}
    >
      {value.map((chip, i) => {
        const isHover = hoverIndex === i && dragIndex !== null && dragIndex !== i;
        return (
          <span
            key={`${chip}-${i}`}
            draggable={!readOnly}
            onDragStart={(e) => {
              setDragIndex(i);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", chip);
            }}
            onDragOver={(e) => {
              if (dragIndex === null || dragIndex === i) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              setHoverIndex(i);
            }}
            onDragLeave={() => {
              if (hoverIndex === i) setHoverIndex(null);
            }}
            onDrop={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              reorder(dragIndex, i);
              setDragIndex(null);
              setHoverIndex(null);
            }}
            onDragEnd={() => {
              setDragIndex(null);
              setHoverIndex(null);
            }}
            className={[
              "group/chip bg-muted text-foreground inline-flex h-6 items-center gap-1 rounded-md pl-1 pr-1.5 text-xs",
              dragIndex === i ? "opacity-40" : "",
              isHover ? "ring-2 ring-primary/60" : "",
              readOnly ? "" : "cursor-grab active:cursor-grabbing",
            ].join(" ")}
          >
            {!readOnly ? (
              <GripVertical className="text-muted-foreground size-3 shrink-0 opacity-50 group-hover/chip:opacity-100" />
            ) : null}
            <span className="truncate">{chip}</span>
            {!readOnly ? (
              <button
                type="button"
                aria-label={`Remove ${chip}`}
                onClick={(e) => {
                  e.stopPropagation();
                  remove(i);
                }}
                className="text-muted-foreground hover:text-foreground -m-1 cursor-pointer p-1"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </span>
        );
      })}
      {!readOnly ? (
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          placeholder={value.length === 0 ? (placeholder ?? "Add an outcome…") : ""}
          className="h-6 min-w-[8rem] flex-1 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
        />
      ) : null}
    </div>
  );
}
