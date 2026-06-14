"use client";

import type { ReactNode } from "react";

import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import {
  CodeEditorInput,
  langFor,
  type CodeLanguage,
} from "@/features/workflows/activity-properties/hints/code-editor";
import { InputSyntaxEditor } from "@/features/workflows/activity-properties/hints/input-syntax";
import { VariableSyntaxEditor } from "@/features/workflows/activity-properties/hints/variable-syntax";
import {
  monacoLanguageOf,
  readWrappedInput,
  withLiteralValue,
} from "@/features/workflows/activity-properties/input-value";
import { useExpressionDescriptors } from "@/lib/api/elsa";

/**
 * Central dispatcher that picks the right editor for the activity input's
 * *current* expression syntax. Mirrors `ExpressionInput.razor`: Literal
 * uses whatever the host hint wants (text, checkbox, dropdown, …); the
 * other syntaxes swap the control entirely.
 *
 * Hints (SingleLine, MultiLine, etc.) pass their literal renderer as
 * `renderLiteral`. The dispatcher handles everything else — code editors
 * for JavaScript / Liquid / Object, picker for Variable / Input.
 */
export function SyntaxEditor({
  ctx,
  renderLiteral,
  codeMinHeight = 80,
}: {
  ctx: HintContext;
  renderLiteral: () => ReactNode;
  codeMinHeight?: number;
}) {
  // Naked inputs (`isWrapped: false`) store the value directly on the
  // activity field and don't carry an expression envelope — so there's no
  // syntax to switch between. Always render the host hint's literal control.
  if (ctx.descriptor.isWrapped === false) return <>{renderLiteral()}</>;

  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const syntax = value.expression?.type ?? "Literal";
  const descriptorsQuery = useExpressionDescriptors();
  const descriptor = descriptorsQuery.data?.find((d) => d.type === syntax);

  // Literal — defer to the host hint.
  if (syntax === "Literal") return <>{renderLiteral()}</>;

  // Variable / Input pickers stay as bespoke editors because they render
  // a workflow-aware dropdown rather than a Monaco surface.
  if (syntax === "Variable") {
    return (
      <VariableSyntaxEditor
        rawValue={value.expression?.value}
        readOnly={ctx.readOnly}
        onChange={(next) => ctx.setRaw(withLiteralValue(value, next))}
      />
    );
  }
  if (syntax === "Input") {
    return (
      <InputSyntaxEditor
        rawValue={value.expression?.value}
        readOnly={ctx.readOnly}
        onChange={(next) => ctx.setRaw(withLiteralValue(value, next))}
      />
    );
  }

  // Anything else: route via Monaco. Prefer the live descriptor's language,
  // fall back to the static `langFor` mapping so we render something
  // sensible before the catalog request lands.
  const monacoLang = monacoLanguageOf(descriptor) ?? langFor(syntax);
  return (
    <CodeEditorInput
      ctx={ctx}
      language={monacoLang as CodeLanguage}
      minHeight={codeMinHeight}
    />
  );
}
