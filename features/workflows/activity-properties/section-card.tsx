"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";

type Props = {
  title: string;
  /** Lucide icon component for the card header. */
  Icon?: ComponentType<{ className?: string }>;
  /** Small chip rendered after the title (e.g. count, status). */
  badge?: ReactNode;
  /** Optional helper line under the title. */
  helper?: string;
  /** Stays open on first render. */
  defaultOpen?: boolean;
  /** Optional inline action rendered on the right of the header. */
  action?: ReactNode;
  /** Tint colour for the icon tile background — semantic per section. */
  tone?: "neutral" | "sky" | "amber" | "violet" | "emerald" | "rose" | "slate";
  children: ReactNode;
};

const TONES: Record<NonNullable<Props["tone"]>, { bg: string; fg: string }> = {
  neutral: { bg: "bg-muted/60", fg: "text-muted-foreground" },
  sky: { bg: "bg-sky-500/12", fg: "text-sky-600 dark:text-sky-400" },
  amber: { bg: "bg-amber-500/12", fg: "text-amber-600 dark:text-amber-400" },
  violet: { bg: "bg-violet-500/12", fg: "text-violet-600 dark:text-violet-400" },
  emerald: { bg: "bg-emerald-500/12", fg: "text-emerald-600 dark:text-emerald-400" },
  rose: { bg: "bg-rose-500/12", fg: "text-rose-600 dark:text-rose-400" },
  slate: { bg: "bg-slate-500/12", fg: "text-slate-600 dark:text-slate-400" },
};

/**
 * Collapsible card used as the building block for the activity properties
 * inspector. Replaces the previous 10-tab strip with a single scrollable
 * column of sections, matching the property-inspector pattern used by
 * Figma / Linear / Notion: every section is visible at a glance via the
 * card header; clicking the chevron expands the inner control set.
 */
export function SectionCard({
  title,
  Icon,
  badge,
  helper,
  defaultOpen = false,
  action,
  tone = "neutral",
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const tint = TONES[tone];

  return (
    <section className="bg-card overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md">
      <header
        className={[
          "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
          open ? "border-b" : "",
        ].join(" ")}
      >
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 rounded-md"
        >
          {Icon ? (
            <span
              className={[
                "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
                tint.bg,
                tint.fg,
              ].join(" ")}
            >
              <Icon className="size-3.5" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold">{title}</span>
              {badge ? badge : null}
            </div>
            {helper ? (
              <p className="text-muted-foreground truncate text-xs">{helper}</p>
            ) : null}
          </div>
          <ChevronDown
            className={[
              "text-muted-foreground size-3.5 shrink-0 transition-transform duration-150",
              open ? "rotate-180" : "rotate-0",
            ].join(" ")}
          />
        </button>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {open ? <div className="p-3">{children}</div> : null}
    </section>
  );
}
