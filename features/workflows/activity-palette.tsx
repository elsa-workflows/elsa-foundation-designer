"use client";

import {
  ChevronDown,
  ChevronRight,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { displayFor, tintFor } from "@/features/workflows/activity-display";
import { useEditorStore } from "@/features/workflows/editor-store";
import { useActivityDescriptors } from "@/lib/api/elsa";
import type { ActivityDescriptor } from "@/lib/api/types";

/**
 * Drag source for the canvas. Each item carries the activity descriptor's
 * type name via `application/x-elsa-activity-type` plus a plain-text fallback.
 */
export const ACTIVITY_DRAG_MIME = "application/x-elsa-activity-type";

export function ActivityPalette() {
  const collapsed = useEditorStore((s) => s.paletteCollapsed);
  const toggle = useEditorStore((s) => s.togglePaletteCollapsed);

  if (collapsed) {
    return <CollapsedRail onExpand={toggle} />;
  }
  return <ExpandedPalette onCollapse={toggle} />;
}

function CollapsedRail({ onExpand }: { onExpand: () => void }) {
  return (
    <div className="flex h-full flex-col items-center gap-3 py-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={onExpand}
              aria-label="Expand activities"
            >
              <PanelLeftOpen className="size-4" />
            </Button>
          }
        />
        <TooltipContent side="right">Show activities</TooltipContent>
      </Tooltip>
      <div className="text-muted-foreground/70 flex flex-col items-center gap-1.5">
        <Layers className="size-3.5" aria-hidden />
        <div
          className="select-none text-2xs font-semibold uppercase tracking-wider"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Activities
        </div>
      </div>
    </div>
  );
}

function ExpandedPalette({ onCollapse }: { onCollapse: () => void }) {
  const q = useActivityDescriptors();
  const [search, setSearch] = useState("");
  // Track which categories the user has explicitly opened. Empty set = every
  // category collapsed (the desired first-render state). An active search
  // bypasses this and auto-expands any category that has matches so the user
  // sees their results.
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupByCategory(q.data ?? [], search), [q.data, search]);
  const isSearching = search.trim().length > 0;
  const matchCount = useMemo(
    () => groups.reduce((sum, g) => sum + g.items.length, 0),
    [groups],
  );

  const isCategoryExpanded = (cat: string) =>
    isSearching ? true : expandedCats.has(cat);

  const toggleCat = (cat: string) =>
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="border-b">
        <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Layers className="text-muted-foreground size-3.5" aria-hidden />
            <span className="text-2xs font-semibold uppercase tracking-wider">
              Activities
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-xs"
                  variant="ghost"
                  onClick={onCollapse}
                  aria-label="Collapse activities"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <PanelLeftClose className="size-3.5" />
                </Button>
              }
            />
            <TooltipContent side="bottom">Hide activities</TooltipContent>
          </Tooltip>
        </div>
        <div className="px-3 pb-2.5">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activities"
              className="h-8 pl-7 pr-7 text-sm"
              aria-label="Search activities"
            />
            {isSearching ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-1.5 -translate-y-1/2 rounded-sm p-0.5 transition-colors outline-none focus-visible:ring-2"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
          {isSearching && !q.isPending ? (
            <p className="text-muted-foreground/80 mt-1.5 text-2xs tabular-nums">
              {matchCount} {matchCount === 1 ? "match" : "matches"}
            </p>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {q.isPending ? (
          <PaletteSkeleton />
        ) : q.isError ? (
          <ErrorState />
        ) : groups.length === 0 ? (
          <EmptyState searching={isSearching} />
        ) : (
          <div className="px-1.5 pt-1.5 pb-3">
            {groups.map((group) => {
              const expanded = isCategoryExpanded(group.category);
              return (
                <div key={group.category} className="mb-0.5">
                  <button
                    type="button"
                    onClick={() => toggleCat(group.category)}
                    className="group/cat hover:bg-muted/70 focus-visible:ring-ring/40 flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors outline-none focus-visible:ring-2"
                    aria-expanded={expanded}
                  >
                    {expanded ? (
                      <ChevronDown className="text-muted-foreground size-3 shrink-0" />
                    ) : (
                      <ChevronRight className="text-muted-foreground size-3 shrink-0" />
                    )}
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: group.color }}
                    />
                    <span className="text-foreground/80 truncate text-2xs font-semibold uppercase tracking-wider">
                      {group.category}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-muted-foreground/80 group-hover/cat:bg-background ml-auto h-4 min-w-[1.25rem] border-border/60 bg-transparent px-1 font-mono text-[10px] font-medium tabular-nums"
                    >
                      {group.items.length}
                    </Badge>
                  </button>
                  {expanded ? (
                    <div className="mt-0.5 flex flex-col gap-px pb-1">
                      {group.items.map((d) => (
                        <PaletteItem key={d.typeName} descriptor={d} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PaletteItem({ descriptor }: { descriptor: ActivityDescriptor }) {
  const display = displayFor(descriptor.typeName, descriptor);
  const Icon = display.icon;
  const label = descriptor.displayName || descriptor.name;

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ACTIVITY_DRAG_MIME, descriptor.typeName);
        e.dataTransfer.setData("text/plain", descriptor.typeName);
        e.dataTransfer.effectAllowed = "copy";
      }}
      title={descriptor.description ?? label}
      className="group/item hover:bg-muted/70 focus-visible:ring-ring/40 flex cursor-grab items-center gap-2 rounded-md px-1.5 py-1 transition-colors outline-none focus-visible:ring-2 active:cursor-grabbing"
    >
      <span
        className="ring-border/40 group-hover/item:ring-border/70 flex size-7 shrink-0 items-center justify-center rounded-md ring-1 transition-colors"
        style={{ background: tintFor(display.color), color: display.color }}
      >
        <Icon className="size-3.5" strokeWidth={2.25} />
      </span>
      <span className="text-foreground/90 group-hover/item:text-foreground min-w-0 flex-1 truncate text-sm transition-colors">
        {label}
      </span>
    </div>
  );
}

function PaletteSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-3">
      {Array.from({ length: 3 }).map((_, ci) => (
        <div key={ci} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 px-1.5">
            <Skeleton className="size-3 rounded-sm" />
            <Skeleton className="size-1.5 rounded-full" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-3 w-5" />
          </div>
          {Array.from({ length: 4 }).map((__, ii) => (
            <div key={ii} className="flex items-center gap-2 px-1.5">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-3 max-w-32 flex-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ searching }: { searching: boolean }) {
  return (
    <div className="text-muted-foreground/80 flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Search className="size-5 opacity-60" aria-hidden />
      <p className="text-xs">
        {searching ? "No activities match your search." : "No activities available."}
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <p className="text-destructive p-3 text-xs">
      Couldn&apos;t load activities.
    </p>
  );
}

type Group = {
  category: string;
  items: ActivityDescriptor[];
  color: string;
};

function groupByCategory(list: ActivityDescriptor[], search: string): Group[] {
  const term = search.trim().toLowerCase();
  const browsable = list.filter((d) => d.isBrowsable !== false);
  const filtered = term
    ? browsable.filter((d) => {
        const hay = `${d.displayName ?? ""} ${d.name} ${d.typeName} ${d.description ?? ""}`.toLowerCase();
        return hay.includes(term);
      })
    : browsable;
  const map = new Map<string, ActivityDescriptor[]>();
  for (const d of filtered) {
    const cat = d.category || "Misc";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(d);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) =>
        (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name),
      ),
      color: displayFor(undefined, { category }).color,
    }));
}
