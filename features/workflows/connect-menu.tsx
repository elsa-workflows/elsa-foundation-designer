"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { displayFor } from "@/features/workflows/activity-display";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type { ActivityDescriptor } from "@/lib/api/types";

type Props = {
  /** Screen-coordinate anchor (where the user clicked / released). */
  clientX: number;
  clientY: number;
  /** Optional pre-filter; useful for porting "Done"-only flow ports later. */
  filter?: (d: ActivityDescriptor) => boolean;
  onPick: (descriptor: ActivityDescriptor) => void;
  onClose: () => void;
};

/**
 * Floating, in-place activity picker. Two contexts:
 *  1. Released a connection over empty pane → wire a new activity to the source port.
 *  2. Clicked the `+` button on an edge → splice a new activity into that edge.
 *
 * Searchable, grouped by category, keyboard-navigable. Mirrors the Blazor
 * react-designer's `ConnectMenu.tsx`.
 */
export function ConnectMenu({ clientX, clientY, filter, onPick, onClose }: Props) {
  const q = useActivityDescriptors();
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const all = (q.data ?? []).filter((d) => d.isBrowsable !== false && (!filter || filter(d)));
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (d) =>
        (d.displayName ?? "").toLowerCase().includes(term) ||
        (d.category ?? "").toLowerCase().includes(term) ||
        d.typeName.toLowerCase().includes(term) ||
        (d.description ?? "").toLowerCase().includes(term),
    );
  }, [q.data, search, filter]);

  // Group by category but keep a flat list for keyboard navigation.
  const groups = useMemo(() => {
    const byCategory = new Map<string, ActivityDescriptor[]>();
    for (const d of filtered) {
      const cat = d.category || "Other";
      const list = byCategory.get(cat) ?? [];
      list.push(d);
      byCategory.set(cat, list);
    }
    return Array.from(byCategory.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  // Flat list in the same order items are rendered, so keyboard navigation and
  // Enter operate on the same sequence the user sees.
  const flatVisualOrder = useMemo(
    () => groups.flatMap(([, items]) => items),
    [groups],
  );

  // Auto-focus the search box on mount.
  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Close on outside click / Esc. mousedown (not click) so React Flow's own
  // pane-click handler can't fight us.
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatVisualOrder.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = flatVisualOrder[activeIndex];
      if (pick) onPick(pick);
    }
  };

  // Position: clamp into viewport so we never render off-screen.
  const left = Math.min(clientX + 4, window.innerWidth - 320);
  const top = Math.min(clientY + 4, window.innerHeight - 340);

  let flatIndex = -1;

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="bg-popover ring-foreground/10 fixed z-50 flex w-[300px] flex-col overflow-hidden rounded-md text-sm shadow-lg ring-1"
      style={{ left, top }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder="Search activities…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setActiveIndex(0);
        }}
        onKeyDown={onInputKey}
        className="border-b bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="max-h-72 overflow-y-auto py-1">
        {q.isPending ? (
          <p className="text-muted-foreground px-2.5 py-3 text-xs">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground px-2.5 py-3 text-xs">
            No matching activities.
          </p>
        ) : (
          groups.map(([category, items]) => (
            <div key={category} className="py-0.5">
              <p className="text-muted-foreground px-2.5 py-1 text-2xs font-medium uppercase tracking-wide">
                {category}
              </p>
              {items.map((d) => {
                flatIndex += 1;
                const isActive = flatIndex === activeIndex;
                const display = displayFor(d.typeName, d);
                const Icon = display.icon;
                return (
                  <button
                    key={d.typeName}
                    type="button"
                    onMouseEnter={() => setActiveIndex(flatIndex)}
                    onClick={() => onPick(d)}
                    className={[
                      "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors",
                      isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    ].join(" ")}
                  >
                    <span
                      className="flex size-6 shrink-0 items-center justify-center rounded-md text-white"
                      style={{ background: display.color }}
                    >
                      <Icon className="size-3.5" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {d.displayName ?? d.typeName.split(".").at(-1)}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-2xs font-mono">
                      {d.kind?.toLowerCase() ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
