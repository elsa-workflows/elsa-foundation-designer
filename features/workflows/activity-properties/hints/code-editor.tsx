"use client";

import { AlertCircle, Maximize2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { CodeEditorDialog } from "@/features/workflows/activity-properties/code-editor-dialog";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { MonacoCodeEditor } from "@/features/workflows/activity-properties/monaco-editor";

export type CodeLanguage = "javascript" | "csharp" | "python" | "json" | "liquid" | "sql";

type Props = {
  ctx: HintContext;
  language?: CodeLanguage;
  minHeight?: number;
};

/**
 * Monaco-backed editor pane for code-like inputs. The inline editor is
 * deliberately compact for the narrow right panel; clicking the **Expand**
 * button pops the same value into a wide modal (`CodeEditorDialog`) where
 * long expressions, JSON payloads and scripts get the room they need.
 *
 * Mirrors the Blazor designer's `BlazorMonaco.Editor.StandaloneCodeEditor`
 * setup but adds the inline ↔ fullscreen split that the side-panel layout
 * makes essential.
 */
export function CodeEditorInput({ ctx, language, minHeight = 120 }: Props) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const syntax = value.expression?.type ?? "JavaScript";
  const resolvedLang: CodeLanguage = language ?? langFor(syntax);
  const currentValue = typeof value.expression?.value === "string" ? value.expression.value : "";
  const [expanded, setExpanded] = useState(false);

  // JSON validation runs on each keystroke so the user sees errors inline.
  const parseError = (() => {
    if (resolvedLang !== "json") return null;
    if (!currentValue.trim()) return null;
    try {
      JSON.parse(currentValue);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Invalid JSON";
    }
  })();

  const label = (ctx.descriptor.displayName ?? ctx.descriptor.name).trim();

  return (
    <div className="flex flex-col gap-1">
      <div className="group/code relative overflow-hidden rounded-md border">
        <MonacoCodeEditor
          value={currentValue}
          language={resolvedLang}
          readOnly={ctx.readOnly}
          height={minHeight}
          onChange={(v) => ctx.setRaw(withLiteralValue(value, v))}
        />
        {/* Expand affordance — top-right of the editor surface */}
        <button
          type="button"
          aria-label="Open in fullscreen editor"
          title="Open in fullscreen editor"
          onClick={() => setExpanded(true)}
          className="bg-background/85 hover:bg-background border-border absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-md border opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/code:opacity-100 focus:opacity-100"
        >
          <Maximize2 className="size-3" />
        </button>
      </div>

      {/* Quick action — also visible without hover for discoverability */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(true)}
        className="text-muted-foreground hover:text-foreground h-6 self-end px-1.5 text-xs"
      >
        <Maximize2 className="size-3" />
        Edit in fullscreen
      </Button>

      {parseError ? (
        <p className="text-destructive inline-flex items-center gap-1 text-xs">
          <AlertCircle className="size-3" />
          {parseError}
        </p>
      ) : null}

      <CodeEditorDialog
        open={expanded}
        onOpenChange={setExpanded}
        title={label}
        subtitle={ctx.descriptor.description ?? undefined}
        initialValue={currentValue}
        language={resolvedLang}
        readOnly={ctx.readOnly}
        onSave={(next) => ctx.setRaw(withLiteralValue(value, next))}
      />
    </div>
  );
}

/**
 * The `code-editor` hint variant — has its own row (label + syntax menu).
 * Initial Monaco language is seeded from the server's `uiSpecifications.
 * codeEditor.language` (set by `CodeEditorOptionsProviderBase` subclasses
 * like `RunJavaScriptOptionsProvider`, `SqlCodeOptionsProvider`,
 * `RunPythonOptionsProvider`), then from `defaultSyntax`. Switching the
 * expression syntax via the chip still wins, just like any wrapped input.
 */
export function CodeEditorHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const syntax = value.expression?.type ?? ctx.descriptor.defaultSyntax ?? "JavaScript";
  const hintedLang = readCodeEditorLanguage(ctx.descriptor.uiSpecifications);
  // Use the syntax-derived language when the user has explicitly switched
  // to a non-Literal syntax (JavaScript / Liquid / Object / SQL …); otherwise
  // honour the server-provided hint so SQL / Python / C# inputs open in the
  // right Monaco grammar instead of falling back to javascript.
  const language: CodeLanguage =
    syntax !== "Literal" ? langFor(syntax) : (hintedLang ?? langFor(syntax));

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <CodeEditorInput ctx={ctx} language={language} minHeight={140} />
    </InputRow>
  );
}

function readCodeEditorLanguage(
  specs: Record<string, unknown> | null | undefined,
): CodeLanguage | undefined {
  if (!specs) return undefined;
  const props = (specs.codeEditor ?? specs.CodeEditor) as
    | Record<string, unknown>
    | undefined;
  const raw = props && (props.language ?? props.Language);
  if (typeof raw !== "string" || !raw) return undefined;
  // Tolerate "JavaScript" / "Sql" / etc. casings.
  return raw.toLowerCase() as CodeLanguage;
}

export function JsonEditorHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <CodeEditorInput ctx={ctx} language="json" minHeight={140} />
    </InputRow>
  );
}

export function ExpressionEditorHint({ ctx }: { ctx: HintContext }) {
  return <CodeEditorHint ctx={ctx} />;
}

/**
 * Static fallback for `syntax → Monaco language`. Most call sites should
 * derive this from `useExpressionDescriptors` + `monacoLanguageOf`; this
 * fallback covers the cases where the descriptor catalog isn't reachable.
 */
export function langFor(syntax: string): CodeLanguage {
  switch (syntax) {
    case "Object":
    case "JSON":
      return "json";
    case "Liquid":
      return "liquid";
    case "C#":
    case "CSharp":
      return "csharp";
    case "Python":
      return "python";
    case "SQL":
    case "Sql":
      return "sql";
    case "JavaScript":
    default:
      return "javascript";
  }
}
