"use client";

import { AlertCircle, CheckCircle2, Loader2, Play } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/features/workflows/editor-store";
import { useTestActivity } from "@/lib/api/elsa";
import type { ActivityJson } from "@/lib/api/types";

type Props = {
  activity: ActivityJson;
};

type TestResult = {
  status?: string;
  activityState?: Record<string, unknown>;
  outcomes?: string[];
  output?: Record<string, unknown>;
  fault?: { type?: string; message?: string; stackTrace?: string };
};

/**
 * Runs the activity in isolation against the backend's test endpoint.
 * Mirrors Blazor's `TestTab.razor`: a single Run button kicks off the test;
 * the response is split into Status / ActivityState / Outcomes / Output /
 * Fault panels. Inputs are pulled live from the activity JSON.
 */
export function ActivityTestsTab({ activity }: Props) {
  const test = useTestActivity();
  const definitionId = useEditorStore((s) => s.definition?.definitionId);
  const [result, setResult] = useState<TestResult | null>(null);

  const onRun = async () => {
    try {
      const res = await test.mutateAsync({
        definitionId: definitionId ?? "",
        activity,
      });
      setResult(res);
      if (res.fault) toast.error("Activity test faulted — see the Fault panel below.");
      else toast.success("Activity test completed.");
    } catch {
      toast.error("Couldn't run the activity test (endpoint unreachable).");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs leading-snug max-w-[26ch]">
          Runs this activity in isolation with its current input values and
          shows the resulting state, outputs and any fault.
        </p>
        <Button
          size="sm"
          onClick={() => void onRun()}
          disabled={test.isPending || !definitionId}
        >
          {test.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          Run activity
        </Button>
      </div>

      {result ? (
        <div className="flex flex-col gap-3">
          <ResultPanel label="Status">
            {result.status ? (
              <StatusBadge status={result.status} />
            ) : (
              <span className="text-muted-foreground text-xs">Unknown</span>
            )}
          </ResultPanel>

          {result.fault ? (
            <ResultPanel label="Fault" tone="destructive">
              <div className="flex items-start gap-1.5">
                <AlertCircle className="text-destructive size-3.5 shrink-0" />
                <div className="flex flex-col gap-0.5 text-xs">
                  {result.fault.type ? (
                    <p className="font-mono">{result.fault.type}</p>
                  ) : null}
                  {result.fault.message ? <p>{result.fault.message}</p> : null}
                  {result.fault.stackTrace ? (
                    <pre className="text-muted-foreground mt-1 overflow-auto whitespace-pre-wrap text-2xs leading-tight">
                      {result.fault.stackTrace}
                    </pre>
                  ) : null}
                </div>
              </div>
            </ResultPanel>
          ) : null}

          {result.outcomes && result.outcomes.length > 0 ? (
            <ResultPanel label="Outcomes">
              <div className="flex flex-wrap gap-1">
                {result.outcomes.map((o) => (
                  <Badge key={o} variant="outline" className="font-mono text-2xs">
                    {o}
                  </Badge>
                ))}
              </div>
            </ResultPanel>
          ) : null}

          {result.output && Object.keys(result.output).length > 0 ? (
            <ResultPanel label="Output">
              <JsonBlock value={result.output} />
            </ResultPanel>
          ) : null}

          {result.activityState && Object.keys(result.activityState).length > 0 ? (
            <ResultPanel label="Activity state">
              <JsonBlock value={result.activityState} />
            </ResultPanel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultPanel({
  label,
  tone = "default",
  children,
}: {
  label: string;
  tone?: "default" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "rounded-md border p-2",
        tone === "destructive" ? "border-destructive/40 bg-destructive/5" : "bg-muted/30",
      ].join(" ")}
    >
      <p className="text-muted-foreground mb-1 text-2xs font-medium uppercase tracking-wide">
        {label}
      </p>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "Completed") {
    return (
      <Badge className="border-emerald-600 bg-emerald-500 text-white">
        <CheckCircle2 className="mr-1 size-3" /> Completed
      </Badge>
    );
  }
  if (status === "Faulted") {
    return (
      <Badge className="border-rose-600 bg-rose-500 text-white">
        <AlertCircle className="mr-1 size-3" /> Faulted
      </Badge>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

function JsonBlock({ value }: { value: Record<string, unknown> }) {
  return (
    <pre className="overflow-auto rounded-sm bg-background p-2 text-xs leading-tight">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
