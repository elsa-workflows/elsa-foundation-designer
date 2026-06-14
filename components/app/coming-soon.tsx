import { Hammer } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Hammer className="size-5" />
          </div>
          <div className="space-y-0.5">
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">Coming in a follow-up phase</p>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {description ??
            "This module is part of the Elsa Studio shell rebuild but hasn't been ported yet. The shell, navigation and design system are in place — feature pages will land in upcoming PRs."}
        </CardContent>
      </Card>
    </div>
  );
}
