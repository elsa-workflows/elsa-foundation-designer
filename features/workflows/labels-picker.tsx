"use client";

import { ChevronDown, Tag, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLabels } from "@/lib/api/elsa";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

/**
 * Compact multi-select for workflow labels. Backed by `useLabels` and stores
 * the chosen ids on `WorkflowDefinition.labelIds`.
 */
export function LabelsPicker({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const labels = useLabels();
  const items = useMemo(() => labels.data ?? [], [labels.data]);

  const selected = useMemo(() => new Set(value), [value]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((l) => l.name.toLowerCase().includes(q));
  }, [items, query]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  const selectedLabels = items.filter((l) => selected.has(l.id));

  return (
    <div className="flex flex-col gap-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={[
            "border-input bg-background flex min-h-9 w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs",
            "focus-visible:ring-ring/50 focus-visible:ring-2 outline-none",
            "disabled:pointer-events-none disabled:opacity-50",
          ].join(" ")}
        >
          <Tag className="text-muted-foreground size-3.5 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {selectedLabels.length === 0 ? (
              <span className="text-muted-foreground">Add labels…</span>
            ) : (
              selectedLabels.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium"
                  style={
                    l.color
                      ? {
                          background: `color-mix(in oklch, ${l.color} 18%, transparent)`,
                          color: l.color,
                        }
                      : { background: "var(--muted)", color: "var(--muted-foreground)" }
                  }
                >
                  {l.name}
                  {!disabled ? (
                    <button
                      type="button"
                      aria-label={`Remove ${l.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(l.id);
                      }}
                      className="hover:opacity-80"
                    >
                      <X className="size-2.5" />
                    </button>
                  ) : null}
                </span>
              ))
            )}
          </div>
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-[var(--anchor-width)] p-0">
          <div className="border-b p-2">
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter labels…"
              className="h-7 text-xs"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {labels.isPending ? (
              <p className="text-muted-foreground px-3 py-2 text-xs">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground px-3 py-2 text-xs">No labels.</p>
            ) : (
              filtered.map((l) => (
                <label
                  key={l.id}
                  className="hover:bg-muted/60 flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs"
                >
                  <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: l.color ?? "var(--muted-foreground)" }}
                    aria-hidden
                  />
                  <span className="truncate">{l.name}</span>
                </label>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
