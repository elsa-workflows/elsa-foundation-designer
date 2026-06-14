"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useElsaApiHealth } from "@/hooks/use-elsa-api-health";
import { useActiveEngineStore } from "@/lib/engines/active-engine-store";
import { getAllEngines, subscribeEngines } from "@/lib/engines/registry";
import { switchEngine } from "@/lib/engines/switch-engine";
import type { ApiHealthTone } from "@/lib/api/health";
import type { EngineDescriptor } from "@/lib/engines/types";
import { cn } from "@/lib/utils";

const toneDotClass: Record<ApiHealthTone, string> = {
  online: "bg-emerald-500",
  checking: "bg-amber-500 animate-pulse",
  offline: "bg-rose-500",
};

function EngineRowDot({ engineId }: { engineId: string }) {
  const health = useElsaApiHealth(engineId);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        toneDotClass[health.tone],
      )}
      title={health.label}
    />
  );
}

export function EngineSwitcher() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const activeEngineId = useActiveEngineStore((s) => s.activeEngineId);

  // Start empty so SSR matches the first client render. The registry merges
  // env-seeded entries with user-added ones from localStorage, which the
  // server can't see — populating after mount avoids the mismatch.
  const [engines, setEngines] = useState<EngineDescriptor[]>([]);
  useEffect(() => subscribeEngines(setEngines), []);

  const active = useMemo(
    () => engines.find((e) => e.id === activeEngineId) ?? engines[0] ?? null,
    [engines, activeEngineId],
  );

  if (!active) return null;

  const onSelect = (id: string) => {
    if (id === activeEngineId) return;
    try {
      switchEngine(id, { router, queryClient });
    } catch (err) {
      console.error("[engines] switch failed:", err);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group/engine-switcher grid flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 text-left outline-none transition-colors",
          "hover:bg-sidebar-accent/30 focus-visible:ring-2 focus-visible:ring-sky-500/60",
        )}
        aria-label={`Active engine: ${active.label}`}
      >
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold tracking-tight">
            {active.label}
          </span>
          <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0 opacity-70 group-hover/engine-switcher:opacity-100" />
        </span>
        <span className="text-muted-foreground truncate font-mono text-[10.5px]">
          {active.url}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className="w-72">
        <div className="text-muted-foreground px-1.5 py-1 text-xs font-medium">
          Switch engine
        </div>
        <DropdownMenuRadioGroup value={activeEngineId} onValueChange={onSelect}>
          {engines.map((e) => (
            <DropdownMenuRadioItem key={e.id} value={e.id} className="pr-8">
              <span className="flex min-w-0 flex-1 items-start gap-2">
                <EngineRowDot engineId={e.id} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{e.label}</span>
                    {e.source === "user" ? (
                      <Badge
                        variant="outline"
                        className="px-1 py-0 text-[9px] uppercase tracking-wide"
                      >
                        Custom
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground truncate font-mono text-[10.5px]">
                    {e.url}
                  </span>
                  {!e.serverAllowlisted ? (
                    <span className="text-destructive text-[10.5px]">
                      Not authorized by server
                    </span>
                  ) : null}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/settings/connection")}
          className="gap-2"
        >
          <Settings2 className="size-3.5" />
          Manage engines…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
