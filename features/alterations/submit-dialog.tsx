"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { tintClasses } from "@/features/alterations/catalog";
import {
  summariseConfig,
  toAlterationJson,
  type StagedAlteration,
} from "@/features/alterations/staging-store";
import {
  useSubmitAlterations,
  type SubmitAlterationsRequest,
} from "@/lib/api/alterations";

type Step = 0 | 1 | 2;

export function SubmitDialog({
  open,
  onOpenChange,
  instanceId,
  items,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  items: StagedAlteration[];
  onSuccess: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open ? (
          <Wizard
            instanceId={instanceId}
            items={items}
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Wizard({
  instanceId,
  items,
  onSuccess,
  onClose,
}: {
  instanceId: string;
  items: StagedAlteration[];
  onSuccess: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [errorBody, setErrorBody] = useState<string | null>(null);

  const submit = useSubmitAlterations();

  const payload: SubmitAlterationsRequest = useMemo(
    () => ({
      alterations: items.map((i) => toAlterationJson(i)),
      filter: {
        emptyFilterSelectsAll: false,
        workflowInstanceIds: [instanceId],
      },
    }),
    [items, instanceId],
  );

  const runSubmit = async () => {
    setErrorBody(null);
    try {
      const res = await submit.mutateAsync(payload);
      setPlanId(res.planId);
      onSuccess();
    } catch (err) {
      setErrorBody(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Submit alterations</DialogTitle>
        <DialogDescription>
          {step === 0 ? (
            <>Confirm the changes that will be applied to instance <span className="font-mono">{instanceId}</span>.</>
          ) : step === 1 ? (
            <>This is the exact request the Studio will send.</>
          ) : (
            <>Submission result</>
          )}
        </DialogDescription>
      </DialogHeader>

      <Stepper step={step} />

      {step === 0 ? <Review items={items} /> : null}
      {step === 1 ? <Preview payload={payload} /> : null}
      {step === 2 ? (
        <Result
          isPending={submit.isPending}
          planId={planId}
          errorBody={errorBody}
        />
      ) : null}

      <DialogFooter>
        {step === 0 ? (
          <>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep(1)} disabled={items.length === 0}>
              Next <ChevronRight className="size-3.5" />
            </Button>
          </>
        ) : step === 1 ? (
          <>
            <Button
              variant="outline"
              type="button"
              onClick={() => setStep(0)}
              disabled={submit.isPending}
            >
              <ArrowLeft className="size-3.5" /> Back
            </Button>
            <Button
              onClick={() => {
                setStep(2);
                void runSubmit();
              }}
              disabled={submit.isPending}
            >
              {submit.isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" type="button" onClick={onClose}>
              Close
            </Button>
            {planId ? (
              <Button
                onClick={() => {
                  onClose();
                  router.push(`/alterations/plans/${planId}`);
                }}
              >
                View plan
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setStep(1);
                  setErrorBody(null);
                }}
                disabled={submit.isPending}
              >
                Try again
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = ["Review", "Preview", "Submit"];
  return (
    <div className="flex items-center gap-2 text-xs">
      {steps.map((label, idx) => {
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={label} className="flex items-center gap-2">
            <span
              className={[
                "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                active
                  ? "bg-primary text-primary-foreground"
                  : done
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {done ? "✓" : idx + 1}
            </span>
            <span
              className={
                active
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }
            >
              {label}
            </span>
            {idx < steps.length - 1 ? (
              <span className="bg-border h-px w-6" aria-hidden />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Review({ items }: { items: StagedAlteration[] }) {
  return (
    <div className="max-h-[50vh] space-y-2 overflow-y-auto">
      {items.map((s) => {
        const t = tintClasses(s.descriptor.tint);
        const Icon = s.descriptor.icon;
        const targetLabel =
          s.descriptor.target === "Activity"
            ? `Activity: ${s.targetActivityDisplayName ?? s.targetActivityId ?? "—"}`
            : s.descriptor.target === "Variable"
              ? "Variable scope"
              : "Whole instance";
        return (
          <Card key={s.id} className="overflow-hidden py-0">
            <CardContent className="relative flex items-start gap-3 p-3">
              <span
                aria-hidden
                className={["absolute inset-y-2 left-0 w-1 rounded-r-sm", t.accent].join(" ")}
              />
              <span
                className={[
                  "ml-1 flex size-7 shrink-0 items-center justify-center rounded-md",
                  t.bg,
                  t.fg,
                ].join(" ")}
              >
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {s.descriptor.displayName}
                </p>
                <p className="text-muted-foreground text-xs">{targetLabel}</p>
                <p className="text-muted-foreground/80 mt-1 text-xs">
                  {summariseConfig(s)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Preview({ payload }: { payload: SubmitAlterationsRequest }) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground font-mono text-xs">
        POST /alterations/submit
      </p>
      <pre className="bg-muted text-foreground/90 max-h-[50vh] overflow-auto rounded-md p-3 text-xs">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  );
}

function Result({
  isPending,
  planId,
  errorBody,
}: {
  isPending: boolean;
  planId: string | null;
  errorBody: string | null;
}) {
  if (isPending) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Submitting…
      </div>
    );
  }
  if (errorBody) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <AlertCircle className="text-destructive size-5 shrink-0" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium">Submission failed.</p>
            <pre className="text-destructive max-h-[200px] overflow-auto whitespace-pre-wrap text-xs">
              {errorBody}
            </pre>
          </div>
        </CardContent>
      </Card>
    );
  }
  if (planId) {
    return (
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex items-start gap-3 pt-4">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Plan submitted.</p>
            <p className="text-muted-foreground text-xs">
              The server is now executing the plan asynchronously. The plan
              details page updates live as jobs report back.
            </p>
            <p className="text-foreground/90 font-mono text-xs">
              Plan id: {planId}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  return null;
}
