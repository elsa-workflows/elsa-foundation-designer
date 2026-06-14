"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useElsaApiHealth } from "@/hooks/use-elsa-api-health";
import type { ApiHealthTone } from "@/lib/api/health";

const toneClasses: Record<ApiHealthTone, string> = {
  online: "bg-emerald-500",
  checking: "bg-amber-500 animate-pulse",
  offline: "bg-rose-500",
};

/**
 * Small status dot anchored to the sidebar brand. Reflects the live REST
 * reachability of the Elsa backend. Wrapped in a tooltip so users can read
 * the state name even when the sidebar is collapsed.
 *
 * Intentionally tracks REST and not SignalR — many deployments don't run the
 * realtime hub, so its state would mis-report the backend as offline.
 */
export function ConnectionDot({ className }: { className?: string }) {
  const health = useElsaApiHealth();

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`Server connection: ${health.label}`}
        className={cn(
          "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-sidebar shadow-sm",
          toneClasses[health.tone],
          className,
        )}
      />
      <TooltipContent side="right">{health.label}</TooltipContent>
    </Tooltip>
  );
}
