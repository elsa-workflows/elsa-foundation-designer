import type { WorkflowSubStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Per-status color tokens. Kept in sync with the dashboard chart's
 * `SERIES` palette (`features/dashboard/activity-chart.tsx`) so a
 * "Faulted" pill here matches the "Faulted" bar there.
 *
 * `color` is used for the dot, text, and ring; the background is rendered
 * as a soft `color-mix` tint of the same color so the badge stays readable
 * in both light and dark themes.
 */
const TONES: Record<WorkflowSubStatus, { color: string; label: string }> = {
  Executing: { color: "var(--chart-1)", label: "Running" },
  Pending: { color: "var(--muted-foreground)", label: "Pending" },
  Suspended: { color: "var(--chart-4)", label: "Suspended" },
  Finished: { color: "var(--chart-2)", label: "Finished" },
  Cancelled: { color: "var(--muted-foreground)", label: "Cancelled" },
  Faulted: { color: "var(--destructive)", label: "Faulted" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: WorkflowSubStatus | string;
  className?: string;
}) {
  const tone = TONES[status as WorkflowSubStatus] ?? {
    color: "var(--muted-foreground)",
    label: status,
  };
  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium tabular-nums",
        className,
      )}
      style={{
        color: tone.color,
        background: `color-mix(in oklch, ${tone.color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${tone.color} 22%, transparent)`,
      }}
    >
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: tone.color }}
      />
      {tone.label}
    </span>
  );
}
