"use client";

import { AlertCircle, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { CopyButton } from "@/features/instances/copy-button";
import {
  getCustomProperty,
  setCustomProperty,
} from "@/features/workflows/activity-properties/custom-props";
import {
  MonacoCodeEditor,
  type MonacoLanguage,
} from "@/features/workflows/activity-properties/monaco-editor";
import { summarizeStrategy } from "@/features/workflows/activity-properties/resilience-strategy-summary";
import { useEditorStore } from "@/features/workflows/editor-store";
import { updateActivity } from "@/features/workflows/update-activity";
import {
  useExpressionDescriptors,
  useResilienceStrategies,
  useWorkflowInstances,
} from "@/lib/api/elsa";
import type { ActivityJson, ResilienceStrategyConfig } from "@/lib/api/types";

const INHERIT_VALUE = "__inherit";

const EXPRESSION_SNIPPET = [
  "// Return the id of a registered strategy at runtime.",
  "// Available ids are listed below — pick any of them.",
  "return \"\";",
].join("\n");

/**
 * Resilience strategy in either **Identifier** mode (pick a registered
 * strategy by id) or **Expression** mode (compute the strategy dynamically
 * at runtime). Persists at `customProperties.resilienceStrategy`, matching
 * Blazor's `Activity.GetResilienceStrategy / SetResilienceStrategy`.
 *
 * Strategies themselves live in the server's `appsettings.Resilience:Strategies`
 * — there's no API to create or edit them at runtime, so the picker is the
 * only knob the user has. The dropdown surfaces the appsettings-derived
 * config (`maxRetryAttempts`, `delay`, `backoffType`, …) under each name so
 * the user can see what each strategy actually does.
 */
export function ActivityResilienceTab({ activity }: { activity: ActivityJson }) {
  const setRoot = useEditorStore((s) => s.setRoot);
  const root = useEditorStore((s) => s.definition?.root);
  const readOnly = !!useEditorStore((s) => s.definition?.isReadonly);
  const strategies = useResilienceStrategies();
  const expressionDescriptors = useExpressionDescriptors();

  const config = getCustomProperty<ResilienceStrategyConfig>(activity, "resilienceStrategy");
  const mode: "Identifier" | "Expression" = config?.mode === "Expression" ? "Expression" : "Identifier";
  const strategyId =
    config?.mode === "Identifier" && config.strategyId ? config.strategyId : INHERIT_VALUE;
  const expressionValue =
    typeof config?.expression?.value === "string" ? config.expression.value : "";
  const expressionType = config?.expression?.type ?? "JavaScript";

  // The richer items are rendered manually inside `SelectItem`; the `items`
  // record is still needed so the Select trigger can resolve the label for
  // the currently-selected id (Base UI reads it from this map).
  const items = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { [INHERIT_VALUE]: "Inherit from workflow default" };
    for (const s of strategies.data ?? []) map[s.id] = s.displayName;
    return map;
  }, [strategies.data]);

  const writeConfig = (next: ResilienceStrategyConfig | null) => {
    if (!root) return;
    setRoot(
      updateActivity(root, activity.id, (a) =>
        setCustomProperty(a, "resilienceStrategy", next),
      ),
    );
  };

  const onModeChange = (m: string) => {
    if (m === "Identifier") {
      writeConfig({ mode: "Identifier", strategyId: null });
    } else if (m === "Expression") {
      writeConfig({
        mode: "Expression",
        expression: { type: expressionType, value: expressionValue || EXPRESSION_SNIPPET },
      });
    }
  };

  const onExpressionTypeChange = (next: string) => {
    writeConfig({
      mode: "Expression",
      expression: { type: next, value: expressionValue },
    });
  };

  // Expression-syntax options scoped to ones that can return a string. The
  // descriptor catalog has metadata about each (Monaco language, browsable),
  // so we filter on `isBrowsable` and skip the pickers (`Variable`/`Input`)
  // which don't make sense here.
  const expressionTypeOptions = useMemo(() => {
    const all = (expressionDescriptors.data ?? []).filter(
      (d) => d.isBrowsable !== false && d.type !== "Variable" && d.type !== "Input" && d.type !== "Literal",
    );
    if (all.length === 0) {
      // Fall back to the two syntaxes Blazor's resilience editor supported.
      return [
        { type: "JavaScript", displayName: "JavaScript" },
        { type: "Liquid", displayName: "Liquid" },
      ];
    }
    return all.map((d) => ({ type: d.type, displayName: d.displayName }));
  }, [expressionDescriptors.data]);

  const monacoLanguageFor = (syntax: string): MonacoLanguage => {
    // Best-effort: look up the descriptor's `properties.MonacoLanguage`, or
    // fall back to the lowercase syntax name. Constrain to the editor's
    // supported language union; unknown values fall back to `plaintext`.
    const d = expressionDescriptors.data?.find((x) => x.type === syntax);
    const props = (d?.properties ?? {}) as Record<string, unknown>;
    let raw: string | null = null;
    for (const [k, v] of Object.entries(props)) {
      if (k.toLowerCase() === "monacolanguage" && typeof v === "string") {
        raw = v;
        break;
      }
    }
    const candidate = (raw ?? syntax).toLowerCase();
    const known: ReadonlyArray<MonacoLanguage> = [
      "javascript",
      "csharp",
      "python",
      "json",
      "liquid",
      "sql",
      "plaintext",
    ];
    return (known as readonly string[]).includes(candidate)
      ? (candidate as MonacoLanguage)
      : "plaintext";
  };

  const strategyIds = (strategies.data ?? []).map((s) => s.id);
  const noStrategies =
    !strategies.isPending && !strategies.isError && (strategies.data ?? []).length === 0;

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={mode} onValueChange={onModeChange} className="flex flex-col gap-2">
        <TabsList variant="line">
          <TabsTrigger value="Identifier">Identifier</TabsTrigger>
          <TabsTrigger value="Expression">Expression</TabsTrigger>
        </TabsList>

        <TabsContent value="Identifier" className="flex flex-col gap-2">
          <Label className="text-xs font-medium">Resilience strategy</Label>
          <Select
            items={items}
            value={strategyId}
            onValueChange={(v) =>
              writeConfig(
                !v || v === INHERIT_VALUE
                  ? null
                  : { mode: "Identifier", strategyId: v },
              )
            }
            disabled={readOnly}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT_VALUE}>
                <div className="flex flex-col">
                  <span>Inherit from workflow default</span>
                  <span className="text-muted-foreground text-2xs">
                    Apply whatever policy the workflow itself declares (or none).
                  </span>
                </div>
              </SelectItem>
              {(strategies.data ?? []).map((s) => {
                const summary = summarizeStrategy(s);
                return (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex flex-col">
                      <span>{s.displayName}</span>
                      <span className="text-muted-foreground text-2xs">
                        {summary
                          ? summary
                          : (typeof s.$type === "string"
                              ? s.$type
                              : s.id)}
                      </span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {strategies.isError ? (
            <div className="bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 flex items-start gap-2 rounded-md border border-amber-300/60 dark:border-amber-800/60 p-2 text-xs">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>Couldn&apos;t load resilience strategies from the server.</span>
            </div>
          ) : noStrategies ? (
            <div className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-md border p-2 text-xs">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>
                Resilience module isn&apos;t loaded on this engine, or no strategies
                are configured. Add entries under{" "}
                <code className="text-2xs">appsettings.Resilience:Strategies</code> to
                enable retries.
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-xs">
              Strategies are configured server-side. Pick one by name — the
              attempt count, delay, and backoff come from{" "}
              <code className="text-2xs">appsettings.Resilience:Strategies</code>.
            </p>
          )}

          {/* Show the selected strategy's resolved config inline as a
              read-only reminder. Useful when the user comes back later. */}
          {strategyId !== INHERIT_VALUE ? (
            <SelectedStrategyDetails id={strategyId} />
          ) : null}
        </TabsContent>

        <TabsContent value="Expression" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Strategy expression</Label>
            <Select
              value={expressionType}
              onValueChange={(v) => v && onExpressionTypeChange(v)}
              disabled={readOnly}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue placeholder="Syntax" />
              </SelectTrigger>
              <SelectContent>
                {expressionTypeOptions.map((o) => (
                  <SelectItem key={o.type} value={o.type}>
                    {o.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-md border">
            <MonacoCodeEditor
              value={expressionValue}
              language={monacoLanguageFor(expressionType)}
              readOnly={readOnly}
              height={140}
              onChange={(v) =>
                writeConfig({
                  mode: "Expression",
                  expression: { type: expressionType, value: v },
                })
              }
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Return the id of a registered strategy at runtime — useful when the
            policy depends on activity inputs or workflow context.
          </p>
          {strategyIds.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-2xs">Available ids:</span>
              {strategyIds.map((id) => (
                <span
                  key={id}
                  className="bg-muted text-foreground inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-2xs"
                >
                  {id}
                  <CopyButton
                    value={id}
                    variant="inline"
                    label={`Copy strategy id ${id}`}
                    successMessage={`Copied ${id}.`}
                  />
                </span>
              ))}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <RecentRetriesLink activityId={activity.id} />
    </div>
  );
}

/**
 * Surfaces a quick "View recent retries" jump-off: looks up the most recent
 * workflow instance for the current definition (whether or not the user is
 * actively viewing it) and links to its viewer. From there the user can
 * click the activity on the canvas to see its retry attempts in the
 * execution-details sheet.
 *
 * Renders nothing when no instances exist — there's no useful destination
 * yet — so the resilience tab stays clean for new workflows.
 */
function RecentRetriesLink({ activityId }: { activityId: string }) {
  const definitionId = useEditorStore((s) => s.definition?.definitionId);
  const instances = useWorkflowInstances({
    definitionId,
    pageSize: 1,
    orderBy: "Created",
    orderDirection: "Descending",
  });
  const latest = instances.data?.items?.[0];
  if (!latest) return null;
  return (
    <div className="bg-muted/30 mt-1 flex items-center justify-between gap-2 rounded-md border p-2 text-xs">
      <div className="flex min-w-0 flex-col">
        <p className="font-medium">Runtime visibility</p>
        <p className="text-muted-foreground truncate">
          Inspect retry attempts recorded for this activity in the most recent run.
        </p>
      </div>
      <Link
        href={`/workflows/instances/${latest.id}?activityId=${activityId}`}
        className="text-primary hover:underline inline-flex shrink-0 items-center gap-1 whitespace-nowrap"
      >
        View recent retries <ExternalLink className="size-3" />
      </Link>
    </div>
  );
}

/**
 * Render the full appsettings-derived configuration of the selected
 * strategy. Acts as a static cue ("this is what you've picked") so the user
 * doesn't have to re-open the dropdown to remember the policy.
 */
function SelectedStrategyDetails({ id }: { id: string }) {
  const strategies = useResilienceStrategies();
  const strategy = strategies.data?.find((s) => s.id === id);
  if (!strategy) return null;
  const summary = summarizeStrategy(strategy);
  return (
    <div className="bg-muted/30 rounded-md border p-2 text-xs">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="text-emerald-600 size-3.5" />
        <span className="font-medium">{strategy.displayName}</span>
        {typeof strategy.$type === "string" ? (
          <Badge variant="outline" className="font-mono text-2xs">
            {strategy.$type}
          </Badge>
        ) : null}
      </div>
      {summary ? (
        <p className="text-muted-foreground mt-1">{summary}</p>
      ) : (
        <p className="text-muted-foreground mt-1">
          Configured server-side. No client-readable parameters reported.
        </p>
      )}
    </div>
  );
}
