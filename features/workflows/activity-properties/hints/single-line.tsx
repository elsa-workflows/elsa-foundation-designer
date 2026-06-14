"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";
import { InputRow } from "@/features/workflows/activity-properties/input-row";
import {
  readWrappedInput,
  withLiteralValue,
  withSyntax,
} from "@/features/workflows/activity-properties/input-value";
import { SyntaxEditor } from "@/features/workflows/activity-properties/syntax-editor";

/** UIHint = "singleline" — short text in Literal mode; swaps to code / picker for other syntaxes. */
export function SingleLineHint({ ctx }: { ctx: HintContext }) {
  const value = readWrappedInput(ctx.activity as Record<string, unknown>, ctx.descriptor);
  const { adornmentText, enableCopyAdornment } = readSingleLineProps(
    ctx.descriptor.uiSpecifications,
  );

  return (
    <InputRow
      descriptor={ctx.descriptor}
      wrappedValue={value}
      onSyntaxChange={(s) => ctx.setRaw(withSyntax(value, s))}
      readOnly={ctx.readOnly}
    >
      <SyntaxEditor
        ctx={ctx}
        renderLiteral={() => {
          const literal =
            typeof value.expression?.value === "string" ? value.expression.value : "";
          const onChange = (next: string) => ctx.setRaw(withLiteralValue(value, next));

          if (!adornmentText && !enableCopyAdornment) {
            return (
              <Input
                id={`in-${ctx.descriptor.name}`}
                value={literal}
                onChange={(e) => onChange(e.target.value)}
                readOnly={ctx.readOnly}
              />
            );
          }

          return (
            <InputGroup>
              {adornmentText ? (
                <InputGroupAddon align="inline-start" className="font-mono text-xs">
                  {adornmentText}
                </InputGroupAddon>
              ) : null}
              <InputGroupInput
                id={`in-${ctx.descriptor.name}`}
                value={literal}
                onChange={(e) => onChange(e.target.value)}
                readOnly={ctx.readOnly}
              />
              {enableCopyAdornment ? (
                <InputGroupAddon align="inline-end">
                  <CopyButton text={`${adornmentText ?? ""}${literal}`} />
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          );
        }}
      />
    </InputRow>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <InputGroupButton
      size="icon-xs"
      aria-label={copied ? "Copied" : "Copy"}
      title={copied ? "Copied" : "Copy full value"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        } catch {
          // Clipboard unavailable; ignore — user can still select-copy manually.
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </InputGroupButton>
  );
}

function pick(o: Record<string, unknown> | null | undefined, ...keys: string[]): unknown {
  if (!o) return undefined;
  for (const k of keys) if (o[k] !== undefined) return o[k];
  return undefined;
}

/**
 * Read `SingleLineProps` written by a backend UIHandler (e.g. Elsa.Http's
 * `HttpEndpointPathUIHandler`) at `uiSpecifications.singleline.{adornmentText,
 * enableCopyAdornment}`.
 */
function readSingleLineProps(specs: Record<string, unknown> | null | undefined) {
  const props = pick(specs, "singleline", "Singleline", "SingleLine") as
    | Record<string, unknown>
    | undefined;
  if (!props) return { adornmentText: "", enableCopyAdornment: false };
  const adornmentText =
    (pick(props, "adornmentText", "AdornmentText") as string | undefined) ?? "";
  const enableCopyAdornment =
    (pick(props, "enableCopyAdornment", "EnableCopyAdornment") as boolean | undefined) ===
    true;
  return { adornmentText, enableCopyAdornment };
}
