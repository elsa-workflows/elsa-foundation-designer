"use client";

import { ChevronDown, Clock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  TimestampFilter,
  TimestampFilterOperator,
} from "@/lib/api/types";

const COLUMN_OPTIONS: { value: TimestampFilter["column"]; label: string }[] = [
  { value: "CreatedAt", label: "Created at" },
  { value: "UpdatedAt", label: "Updated at" },
  { value: "FinishedAt", label: "Finished at" },
];

const OPERATOR_OPTIONS: { value: TimestampFilterOperator; label: string }[] = [
  { value: "GreaterThanOrEqual", label: "≥ (on or after)" },
  { value: "GreaterThan", label: "> (after)" },
  { value: "LessThanOrEqual", label: "≤ (on or before)" },
  { value: "LessThan", label: "< (before)" },
  { value: "Is", label: "= (is)" },
  { value: "IsNot", label: "≠ (is not)" },
];

const COLUMN_LABEL: Record<TimestampFilter["column"], string> = {
  CreatedAt: "Created",
  UpdatedAt: "Updated",
  FinishedAt: "Finished",
};

/** `value → label` maps so `<SelectValue />` renders the friendly label. */
const COLUMN_ITEMS: Record<string, string> = Object.fromEntries(
  COLUMN_OPTIONS.map((o) => [o.value, o.label]),
);
const OPERATOR_ITEMS: Record<string, string> = Object.fromEntries(
  OPERATOR_OPTIONS.map((o) => [o.value, o.label]),
);

const OPERATOR_SHORT: Record<TimestampFilterOperator, string> = {
  GreaterThanOrEqual: "≥",
  GreaterThan: ">",
  LessThanOrEqual: "≤",
  LessThan: "<",
  Is: "=",
  IsNot: "≠",
};

type Props = {
  value: TimestampFilter[];
  onChange: (next: TimestampFilter[]) => void;
};

/**
 * Multi-row time-range filter for the instances list. Each row applies a
 * single (column × operator × timestamp) predicate; the server ANDs all rows
 * together. Mirrors the Blazor filter's expressive surface in a compact
 * popover that fits next to the other filter dropdowns.
 *
 * The HTML5 `datetime-local` input is used for the timestamp picker — its
 * value is interpreted in the user's local timezone and converted to a UTC
 * ISO string before being committed.
 */
export function TimeRangeFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const update = (i: number, patch: Partial<TimestampFilter>) =>
    onChange(value.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const addRow = () => {
    onChange([
      ...value,
      {
        column: "CreatedAt",
        operator: "GreaterThanOrEqual",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Compact summary for the trigger button. With ≤ 2 rows we render a short
  // human form; beyond that we just show a count to keep the chip narrow.
  const summary =
    value.length === 0
      ? "Any time"
      : value.length === 1
        ? `${COLUMN_LABEL[value[0].column]} ${OPERATOR_SHORT[value[0].operator]} ${formatShort(value[0].timestamp)}`
        : `${value.length} time filters`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        data-testid="time-range-filter-trigger"
        className={[
          "border-input bg-background flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),10px)] border px-2 text-xs",
          "focus-visible:ring-ring/50 focus-visible:ring-2 outline-none",
          value.length > 0 ? "border-primary/50" : "",
        ].join(" ")}
      >
        <Clock className="text-muted-foreground size-3.5 shrink-0" />
        <span className={value.length === 0 ? "text-muted-foreground" : ""}>{summary}</span>
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[28rem] p-0">
        <div className="flex items-center justify-between border-b p-2">
          <p className="text-muted-foreground text-xs font-medium">
            Filter by time
          </p>
          {value.length > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onChange([])}
              title="Clear all"
            >
              Clear all
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5 p-2">
          {value.length === 0 ? (
            <p className="text-muted-foreground px-1 py-3 text-center text-xs">
              No time filters. Click <span className="font-medium">Add filter</span>{" "}
              to scope the list to a date range.
            </p>
          ) : (
            value.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[7rem_7.5rem_1fr_auto] items-center gap-1.5"
              >
                <Select
                  items={COLUMN_ITEMS}
                  value={row.column}
                  onValueChange={(v) =>
                    v && update(i, { column: v as TimestampFilter["column"] })
                  }
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLUMN_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  items={OPERATOR_ITEMS}
                  value={row.operator}
                  onValueChange={(v) =>
                    v && update(i, { operator: v as TimestampFilterOperator })
                  }
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATOR_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="datetime-local"
                  value={toLocalInputValue(row.timestamp)}
                  onChange={(e) => {
                    const next = fromLocalInputValue(e.target.value);
                    if (next) update(i, { timestamp: next });
                  }}
                  className="h-7 text-xs"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(i)}
                  aria-label="Remove this filter"
                  title="Remove"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={addRow}
            className="mt-1 w-fit"
          >
            <Plus className="size-3.5" /> Add filter
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Compact `Sep 12, 14:30` style label for a single-row summary. */
function formatShort(iso: string): string {
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    return `${date}, ${time}`;
  } catch {
    return iso;
  }
}

/**
 * Convert an ISO timestamp to the `YYYY-MM-DDTHH:MM` form that `<input
 * type="datetime-local">` requires. We render in the user's local timezone
 * because that matches the picker's interpretation.
 */
function toLocalInputValue(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function fromLocalInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
