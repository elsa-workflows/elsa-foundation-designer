"use client";

import { Pause, Play, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  POLLING_OPTIONS,
  type PollingMs,
} from "@/features/workflows/use-polling-interval";

const LABELS: Record<PollingMs, string> = {
  0: "Off",
  3000: "3 s",
  5000: "5 s",
  15000: "15 s",
  60000: "1 min",
};

type Props = {
  value: PollingMs;
  onChange: (next: PollingMs) => void;
  /** Trigger a one-shot refetch independent of the polling cadence. */
  onRefreshNow: () => void;
  busy?: boolean;
};

/**
 * Header control bundling the polling-interval choice with a one-shot Refresh
 * button. The trigger renders the Pause icon when polling is off so the off
 * state is unambiguous, and shows the chosen interval as a small label.
 */
export function PollingIntervalPicker({ value, onChange, onRefreshNow, busy }: Props) {
  const off = value === 0;
  return (
    <div className="flex items-center">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              aria-label={off ? "Auto-refresh off" : `Auto-refresh every ${LABELS[value]}`}
              title={off ? "Auto-refresh off" : `Auto-refresh every ${LABELS[value]}`}
            />
          }
        >
          {off ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          <span className="ml-1 text-2xs tabular-nums text-muted-foreground">
            {LABELS[value]}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-32">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Auto-refresh</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            {POLLING_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt}
                onSelect={() => onChange(opt)}
                className={value === opt ? "font-medium" : undefined}
              >
                {LABELS[opt]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRefreshNow}
        disabled={busy}
        aria-label="Refresh now"
        title="Refresh now (⌘/Ctrl + R)"
      >
        <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
