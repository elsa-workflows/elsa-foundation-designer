"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpFromLine,
  ExternalLink,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  ActivityBindings,
  BindingKind,
  BindingRef,
} from "@/features/workflows/activity-bindings";
import {
  useEditorStore,
  type PropertiesSubTab,
} from "@/features/workflows/editor-store";

/**
 * Tone map per binding kind, applied to both the section header pill and
 * the entry row. Missing bindings always render in rose.
 */
const KIND_TONES: Record<BindingKind, string> = {
  variable:
    "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  input: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  output:
    "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-200",
};

const MISSING_TONE =
  "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200";

const KIND_LABEL: Record<BindingKind, string> = {
  variable: "Variable",
  input: "Workflow input",
  output: "Workflow output",
};

/** Which Properties sub-tab to deep-link to for each binding kind. */
const KIND_SUBTAB: Record<BindingKind, PropertiesSubTab> = {
  variable: "variables",
  input: "io",
  output: "io",
};

/**
 * Compact "usage" badge that sits at the bottom of an activity card. Shows
 * the read/write counts at a glance; clicking opens a popover with the full
 * grouped list, each entry deep-linking to the right Properties sub-tab so
 * the user can edit the referenced variable / input / output in one hop.
 *
 * Hidden entirely when the activity touches no workflow state.
 */
export function ActivityBindingsStrip({
  bindings,
  filled,
}: {
  bindings: ActivityBindings;
  /** Whether the surrounding card uses a coloured filled background. Drives
   *  the divider tint so it stays visible on dark/saturated cards. */
  filled: boolean;
}) {
  const { reads, writes } = bindings;
  if (reads.length === 0 && writes.length === 0) return null;

  const missingCount =
    reads.filter((b) => b.missing).length + writes.filter((b) => b.missing).length;

  return (
    <div
      className={[
        "flex items-center justify-end gap-1 border-t px-2 py-1",
        filled ? "border-white/20" : "border-border/70 bg-muted/30",
      ].join(" ")}
    >
      <Popover>
        <PopoverTrigger
          className={[
            "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-px text-2xs leading-none transition-colors",
            "hover:bg-background focus-visible:ring-2 focus-visible:ring-ring/50 outline-none",
            filled
              ? "border-white/30 bg-white/15 text-white"
              : "border-border bg-card text-muted-foreground",
          ].join(" ")}
          aria-label={`Used workflow state — ${reads.length} read${
            reads.length === 1 ? "" : "s"
          }, ${writes.length} write${writes.length === 1 ? "" : "s"}`}
          title="See workflow state used by this activity"
        >
          {reads.length > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <ArrowDown className="size-2.5" />
              <span className="tabular-nums">{reads.length}</span>
            </span>
          ) : null}
          {reads.length > 0 && writes.length > 0 ? (
            <span className="opacity-40">·</span>
          ) : null}
          {writes.length > 0 ? (
            <span className="inline-flex items-center gap-0.5">
              <ArrowUp className="size-2.5" />
              <span className="tabular-nums">{writes.length}</span>
            </span>
          ) : null}
          {missingCount > 0 ? (
            <AlertTriangle className="size-2.5 text-rose-500" />
          ) : null}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={6}
          className="w-72 p-0"
          // The popover lives over the canvas; stop wheel events from bubbling
          // up to React Flow so scrolling inside long lists doesn't zoom the
          // viewport.
          onWheelCapture={(e) => e.stopPropagation()}
        >
          <BindingsList reads={reads} writes={writes} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function BindingsList({
  reads,
  writes,
}: {
  reads: BindingRef[];
  writes: BindingRef[];
}) {
  return (
    <div className="flex flex-col">
      <header className="border-b px-3 py-2">
        <p className="text-xs font-semibold">Workflow state used</p>
        <p className="text-muted-foreground text-2xs">
          Click an entry to open it in the workflow Properties panel.
        </p>
      </header>
      <div className="flex max-h-80 flex-col overflow-y-auto py-1">
        <Section
          title="Reads"
          icon={<ArrowDownToLine className="size-3" />}
          items={reads}
          side="read"
        />
        <Section
          title="Writes"
          icon={<ArrowUpFromLine className="size-3" />}
          items={writes}
          side="write"
        />
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  items,
  side,
}: {
  title: string;
  icon: ReactNode;
  items: BindingRef[];
  side: "read" | "write";
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col">
      <div className="text-muted-foreground flex items-center gap-1.5 px-3 py-1 text-2xs font-semibold uppercase tracking-wide">
        {icon}
        <span>{title}</span>
        <span className="tabular-nums">· {items.length}</span>
      </div>
      <ul className="flex flex-col">
        {items.map((b, idx) => (
          // Two activity slots can bind to the same memory reference id
          // (e.g. both `Result` and `OutputData` writing to the same
          // variable), so the `kind:key` pair isn't unique. Adding the
          // index disambiguates without losing semantic info.
          <BindingRow key={`${side}:${idx}:${b.kind}:${b.key}`} binding={b} />
        ))}
      </ul>
    </section>
  );
}

function BindingRow({ binding }: { binding: BindingRef }) {
  const tone = binding.missing ? MISSING_TONE : KIND_TONES[binding.kind];
  const setTab = useEditorStore((s) => s.setTab);
  const setSubTab = useEditorStore((s) => s.setPropertiesSubTab);
  const goToProperties = () => {
    setTab("properties");
    setSubTab(KIND_SUBTAB[binding.kind]);
  };
  return (
    <li>
      <button
        type="button"
        onClick={goToProperties}
        className="hover:bg-muted/60 focus-visible:bg-muted/60 group flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs outline-none transition-colors"
      >
        <span
          className={[
            "inline-flex shrink-0 items-center rounded-md border px-1.5 py-px text-2xs leading-none",
            tone,
          ].join(" ")}
          title={KIND_LABEL[binding.kind]}
        >
          {KIND_LABEL[binding.kind][0]}
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate font-medium">{binding.name}</span>
          {binding.via ? (
            <span className="text-muted-foreground truncate text-2xs">
              via {binding.via}
              {binding.missing ? " · missing from workflow" : ""}
            </span>
          ) : binding.missing ? (
            <span className="text-rose-600 truncate text-2xs">
              missing from workflow
            </span>
          ) : null}
        </span>
        {binding.missing ? (
          <AlertTriangle className="text-rose-500 size-3 shrink-0" />
        ) : (
          <ExternalLink className="text-muted-foreground/60 group-hover:text-foreground size-3 shrink-0" />
        )}
      </button>
    </li>
  );
}
