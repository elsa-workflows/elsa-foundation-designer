"use client";

import { Maximize2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CodeEditorDialog } from "@/features/workflows/activity-properties/code-editor-dialog";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

/**
 * Multi-line plain text. Most user content fits in the inline textarea, but
 * long content (email bodies, prompt templates, error messages) wants real
 * estate — the **Expand** button pops the value into the same fullscreen
 * editor used by code inputs, in plaintext mode.
 */
export function MultiLineHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const currentValue = typeof value.expression?.value === "string" ? value.expression.value : "";
  const [expanded, setExpanded] = useState(false);
  const label = (ctx.descriptor.displayName ?? ctx.descriptor.name).trim();

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <SyntaxEditor
        codeMinHeight={140}
        ctx={ctx}
        renderLiteral={() => (
          <div className="flex flex-col gap-1">
            <div className="group/multi relative">
              <Textarea
                id={`in-${ctx.descriptor.name}`}
                rows={5}
                value={currentValue}
                onChange={(e) => ctx.setRaw(withLiteralValue(value, e.target.value))}
                readOnly={ctx.readOnly}
              />
              <button
                type="button"
                aria-label="Open in fullscreen editor"
                title="Open in fullscreen editor"
                onClick={() => setExpanded(true)}
                className="bg-background/85 hover:bg-background border-border absolute right-1.5 top-1.5 inline-flex size-6 items-center justify-center rounded-md border opacity-0 shadow-sm backdrop-blur transition-opacity group-hover/multi:opacity-100 focus:opacity-100"
              >
                <Maximize2 className="size-3" />
              </button>
            </div>
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
            <CodeEditorDialog
              open={expanded}
              onOpenChange={setExpanded}
              title={label}
              subtitle={ctx.descriptor.description ?? undefined}
              initialValue={currentValue}
              language="plaintext"
              readOnly={ctx.readOnly}
              onSave={(next) => ctx.setRaw(withLiteralValue(value, next))}
            />
          </div>
        )}
      />
    </InputRow>
  );
}
