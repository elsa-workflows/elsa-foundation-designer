"use client";

import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  hint,
  icon: Icon,
  value,
  loading,
  tone = "default",
}: {
  label: string;
  hint?: string;
  icon: LucideIcon;
  value: number | string | null;
  loading: boolean;
  tone?: "default" | "primary" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "warning"
        ? "text-amber-500 dark:text-amber-400"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`size-4 ${toneClass} opacity-80`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
            {value ?? "—"}
          </div>
        )}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
