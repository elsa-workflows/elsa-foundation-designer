"use client";

import {
  Activity,
  ClipboardList,
  FileBox,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

/**
 * Visual shell shared by the workflow definitions and workflow instances list
 * pages. Provides a consistent hero header (brand square + title + description
 * + actions slot) and a content area with the same spacing rhythm. The
 * components below are intentionally small and presentational so the existing
 * table components stay in charge of state.
 */

/**
 * Identifier for a list-page hero icon. Resolved internally to a Lucide
 * component so server pages can stay server components — Next.js can't
 * serialise function references (icon components) across the RSC boundary,
 * but a string discriminator crosses fine.
 */
export type ListPageKind =
  | "definitions"
  | "instances"
  | "alteration-instances"
  | "alteration-plans";

const LIST_PAGE_ICONS: Record<ListPageKind, LucideIcon> = {
  definitions: FileBox,
  instances: Activity,
  "alteration-instances": ListChecks,
  "alteration-plans": ClipboardList,
};

/**
 * Per-page tint. Mirrors the colours the matching nav module advertises so the
 * page hero and the sidebar feel like the same surface — Workflows uses the
 * brand sky tone (the `--primary` token), Alterations uses violet (the same
 * `text-violet-600` the alterations nav uses for its module icon).
 *
 * `squareGradient` and `wash` accept CSS color expressions; we keep them as
 * inline-style values so callers don't need to wire Tailwind safelist hints.
 */
const LIST_PAGE_TINT: Record<
  ListPageKind,
  { squareGradient: string; wash: string }
> = {
  definitions: {
    squareGradient:
      "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 80%, black))",
    wash: "color-mix(in oklch, var(--primary) 5%, var(--background))",
  },
  instances: {
    squareGradient:
      "linear-gradient(135deg, var(--primary), color-mix(in oklch, var(--primary) 80%, black))",
    wash: "color-mix(in oklch, var(--primary) 5%, var(--background))",
  },
  "alteration-instances": {
    // Violet — same family as `bg-violet-500/12 text-violet-600` in
    // `features/alterations/module.ts`. Uses the `--chart-5` token which is
    // already the project's violet (and adapts to dark mode).
    squareGradient:
      "linear-gradient(135deg, var(--chart-5), color-mix(in oklch, var(--chart-5) 80%, black))",
    wash: "color-mix(in oklch, var(--chart-5) 5%, var(--background))",
  },
  "alteration-plans": {
    squareGradient:
      "linear-gradient(135deg, var(--chart-5), color-mix(in oklch, var(--chart-5) 80%, black))",
    wash: "color-mix(in oklch, var(--chart-5) 5%, var(--background))",
  },
};

type ListPageShellProps = {
  /** Optional — when set, picks the matching tint for the page wash. */
  kind?: ListPageKind;
  children: React.ReactNode;
};

/**
 * Top-level wrapper. Sets the page padding and column gap that all list pages
 * share, plus a subtle vertical-gradient background tinted by `kind` so the
 * page identity (Workflows / Alterations / …) shows through.
 */
export function ListPageShell({ kind = "definitions", children }: ListPageShellProps) {
  const { wash } = LIST_PAGE_TINT[kind];
  return (
    <main
      className="flex flex-1 flex-col gap-5 px-6 pt-5 pb-6"
      style={{
        background: `linear-gradient(to bottom, ${wash} 0%, var(--background) 240px)`,
      }}
    >
      {children}
    </main>
  );
}

type ListPageHeaderProps = {
  /** Selects which Lucide icon renders inside the brand square. */
  kind: ListPageKind;
  title: string;
  description?: string;
  /** Right-aligned actions slot (CTA buttons, etc.). */
  actions?: React.ReactNode;
};

/**
 * Page hero. Echoes the logo's geometry: a rounded square in the brand sky
 * tone with a single icon inside. Sets a clear visual anchor for the page
 * without dominating the toolbar that follows.
 */
export function ListPageHeader({
  kind,
  title,
  description,
  actions,
}: ListPageHeaderProps) {
  const Icon = LIST_PAGE_ICONS[kind];
  const { squareGradient } = LIST_PAGE_TINT[kind];
  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
          style={{ background: squareGradient }}
          aria-hidden
        >
          <Icon className="size-5" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

type FilterToolbarProps = {
  children: React.ReactNode;
};

/**
 * Visual container for the filter row. Wraps the existing inline filter
 * chips in a card surface so the table below has clearer separation. Stays
 * non-sticky for now — sticky positioning fights against the page-level
 * gradient on smaller viewports.
 */
export function FilterToolbar({ children }: FilterToolbarProps) {
  return (
    <div className="bg-card flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 shadow-xs ring-1 ring-black/[0.02] dark:ring-white/5">
      {children}
    </div>
  );
}

type ListEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

/** Centered empty state used inside the table body when there are no rows. */
export function ListEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: ListEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {Icon ? (
        <span
          className="bg-muted/60 ring-border flex size-14 items-center justify-center rounded-2xl ring-1"
          aria-hidden
        >
          <Icon className="text-muted-foreground size-6 opacity-70" />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        {description ? (
          <p className="text-muted-foreground max-w-md text-xs leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

type ListPaginationProps = {
  page: number;
  totalPages: number;
  /** 1-based first index on the page. */
  first: number;
  /** 1-based last index on the page. */
  last: number;
  total: number;
  busy?: boolean;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Footer pager. Shows a precise "X–Y of Z" string and pill-shaped prev/next
 * buttons. Kept tight (h-7) so it doesn't fight the table's information
 * density.
 */
export function ListPagination({
  page,
  totalPages,
  first,
  last,
  total,
  busy,
  onPrev,
  onNext,
}: ListPaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <span className="text-muted-foreground text-xs tabular-nums">
        {total > 0 ? (
          <>
            <span className="text-foreground font-medium">{first}–{last}</span>{" "}
            of {total}
          </>
        ) : (
          "No results"
        )}
      </span>
      <div className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
        <PagerButton
          aria-label="Previous page"
          onClick={onPrev}
          disabled={page === 0 || busy}
        >
          ← Prev
        </PagerButton>
        <span className="px-1.5">
          Page <span className="text-foreground font-medium">{page + 1}</span>{" "}
          of {totalPages}
        </span>
        <PagerButton
          aria-label="Next page"
          onClick={onNext}
          disabled={page + 1 >= totalPages || busy}
        >
          Next →
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={[
        "border-input bg-background inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:opacity-40 disabled:hover:bg-background disabled:hover:text-foreground",
        "focus-visible:ring-ring/50 focus-visible:ring-2 outline-none",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
