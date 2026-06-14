"use client";

import { format } from "date-fns";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DefinitionGraph } from "@/features/workflows/definition-graph";
import { useWorkflowDefinition } from "@/lib/api/elsa";

export function DefinitionViewer({ definitionId }: { definitionId: string }) {
  const q = useWorkflowDefinition(definitionId, "Latest");
  const def = q.data;

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Button variant="ghost" size="icon-sm" aria-label="Back" render={<Link href="/workflows/definitions" />}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            {def?.name ?? <span className="text-muted-foreground font-mono text-sm">{definitionId}</span>}
          </h1>
          {def?.description ? (
            <p className="text-muted-foreground truncate text-xs">{def.description}</p>
          ) : null}
        </div>
        {def ? (
          <div className="flex items-center gap-2 text-xs">
            <Badge variant={def.isPublished ? "default" : "outline"} className="font-normal">
              {def.isPublished ? "Published" : "Draft"}
            </Badge>
            <span className="text-muted-foreground tabular-nums">v{def.version}</span>
            <span className="text-muted-foreground hidden sm:inline">
              · {format(new Date(def.createdAt), "yyyy-MM-dd HH:mm")}
            </span>
          </div>
        ) : null}
      </div>

      <div className="relative flex-1">
        {q.isPending ? (
          <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Loading workflow…
          </div>
        ) : q.isError || !def ? (
          <div className="flex h-full items-center justify-center p-6">
            <Card className="max-w-md">
              <CardContent className="flex items-start gap-3 pt-6">
                <AlertCircle className="text-destructive size-5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Couldn&apos;t load this workflow.</p>
                  <p className="text-muted-foreground text-xs">
                    Either the definition ID is unknown or the Elsa server returned an error.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <DefinitionGraph definition={def} />
        )}
      </div>
    </main>
  );
}
