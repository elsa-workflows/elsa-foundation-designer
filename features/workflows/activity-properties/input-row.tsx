"use client";

import { Code, FunctionSquare, HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  FALLBACK_EXPRESSION_DESCRIPTORS,
  monacoLanguageOf,
  type WrappedInputValue,
} from "@/features/workflows/activity-properties/input-value";
import { useExpressionDescriptors } from "@/lib/api/elsa";
import type { ExpressionDescriptor, PropertyDescriptor } from "@/lib/api/types";

type Props = {
  descriptor: PropertyDescriptor;
  /** When set, the row shows a syntax-picker menu and the right adornment is wired. */
  wrappedValue?: WrappedInputValue;
  onSyntaxChange?: (syntax: string) => void;
  readOnly?: boolean;
  children: ReactNode;
};

/**
 * Standard chrome around every input/output control: label, optional helper
 * tooltip, type pill, and — for wrapped inputs — the expression-syntax
 * switcher. The switcher tints itself brand-blue whenever the field is in any
 * non-literal mode, so a quick scan of the panel surfaces every dynamic field.
 */
export function InputRow({
  descriptor,
  wrappedValue,
  onSyntaxChange,
  readOnly,
  children,
}: Props) {
  const id = `in-${descriptor.name}`;
  const displayName = descriptor.displayName?.trim() || descriptor.name;
  const syntax = wrappedValue?.expression?.type ?? "Literal";
  // The syntax switcher only makes sense for wrapped inputs (`isWrapped !==
  // false`). A naked input stores its value directly on the activity — there's
  // no `expression` envelope, and no other syntaxes are valid for it.
  const isNaked =
    (descriptor as { isWrapped?: boolean }).isWrapped === false;
  const showSyntax = !isNaked && !!wrappedValue && !!onSyntaxChange;
  const isExpression = showSyntax && syntax !== "Literal";

  const descriptorsQuery = useExpressionDescriptors();
  const liveDescriptors: ReadonlyArray<ExpressionDescriptor> =
    descriptorsQuery.data && descriptorsQuery.data.length > 0
      ? descriptorsQuery.data
      : (FALLBACK_EXPRESSION_DESCRIPTORS as unknown as ReadonlyArray<ExpressionDescriptor>);
  const browsable = liveDescriptors.filter((d) => d.isBrowsable !== false);
  const currentDescriptor = browsable.find((d) => d.type === syntax);
  const isCode = !!monacoLanguageOf(currentDescriptor);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Label htmlFor={id} className="text-xs font-medium">
          {displayName}
        </Label>
        {descriptor.description ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`About ${displayName}`}
                  className="text-muted-foreground hover:text-foreground -m-1 cursor-help p-1"
                />
              }
            >
              <HelpCircle className="size-3" />
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">{descriptor.description}</TooltipContent>
          </Tooltip>
        ) : null}
        <span
          className="bg-muted/60 text-muted-foreground ml-auto rounded-md px-1.5 py-0.5 font-mono text-2xs leading-none"
          title={descriptor.typeName}
        >
          {shortTypeName(descriptor.typeName)}
        </span>
      </div>

      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">{children}</div>

        {showSyntax ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={readOnly}
              title={`Syntax: ${syntax}`}
              className={[
                "inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium outline-none transition-colors",
                "focus-visible:ring-2 focus-visible:ring-ring/50",
                "disabled:pointer-events-none disabled:opacity-50",
                isExpression
                  ? "bg-primary/10 text-primary hover:bg-primary/15"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              {isCode ? <Code className="size-3" /> : <FunctionSquare className="size-3" />}
              <span>{currentDescriptor?.displayName ?? syntax}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="text-muted-foreground px-1.5 py-1 text-2xs font-medium uppercase tracking-wide">
                Switch to
              </div>
              <DropdownMenuSeparator />
              {browsable.map((s) => {
                const lang = monacoLanguageOf(s);
                const active = syntax === s.type;
                return (
                  <DropdownMenuItem
                    key={s.type}
                    onClick={() => onSyntaxChange!(s.type)}
                    className={
                      active ? "border-primary/40 border-l-2 bg-accent pl-1.5" : undefined
                    }
                  >
                    {lang ? <Code className="size-3.5" /> : <FunctionSquare className="size-3.5" />}
                    {s.displayName}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

function shortTypeName(name: string): string {
  const noGenerics = name.split("`")[0];
  const segs = noGenerics.split(".");
  return segs[segs.length - 1] ?? name;
}
