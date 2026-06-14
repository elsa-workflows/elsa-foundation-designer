/**
 * Helpers for reading and writing the wrapped-input envelope used by Elsa
 * activities. An activity's input property is stored as either:
 *
 *   wrapped:  { typeName, expression: { type, value }, memoryReference? }
 *   naked:    "raw literal value"   // only when InputDescriptor.IsWrapped === false
 *
 * Switching the syntax of a wrapped input swaps `expression.type` (Literal /
 * JavaScript / Liquid / Variable / Input / Object) and keeps the same value
 * cell around, so users can flip representations without losing their work.
 */
import type { InputDescriptor, OutputDescriptor } from "@/lib/api/types";

export type ExpressionSyntax =
  | "Literal"
  | "JavaScript"
  | "Liquid"
  | "Object"
  | "Variable"
  | "Input";

export type Expression = {
  type: ExpressionSyntax | (string & {});
  value: unknown;
};

export type WrappedInputValue = {
  typeName: string;
  expression?: Expression | null;
  memoryReference?: { id?: string | null } | null;
};

export type OutputBindingValue = {
  typeName: string;
  memoryReference?: { id?: string | null } | null;
};

/** Lowercases the first character — matches Elsa's JSON property naming. */
export function camelize(name: string): string {
  if (!name) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

export function readWrappedInput(
  activity: Record<string, unknown>,
  descriptor: Pick<InputDescriptor, "name" | "typeName">,
): WrappedInputValue {
  const key = camelize(descriptor.name);
  const raw = activity[key];
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<WrappedInputValue>;
    return {
      typeName: obj.typeName ?? descriptor.typeName,
      expression: obj.expression ?? null,
      memoryReference: obj.memoryReference ?? null,
    };
  }
  // Tolerate older wires that stored a naked value on a wrapped input.
  return {
    typeName: descriptor.typeName,
    expression:
      raw === undefined
        ? null
        : { type: "Literal", value: raw },
  };
}

export function readNakedInput(
  activity: Record<string, unknown>,
  descriptor: Pick<InputDescriptor, "name">,
): unknown {
  return activity[camelize(descriptor.name)];
}

export function readOutputBinding(
  activity: Record<string, unknown>,
  descriptor: Pick<OutputDescriptor, "name" | "typeName">,
): OutputBindingValue {
  const key = camelize(descriptor.name);
  const raw = activity[key];
  if (raw && typeof raw === "object") {
    const obj = raw as Partial<OutputBindingValue>;
    return {
      typeName: obj.typeName ?? descriptor.typeName,
      memoryReference: obj.memoryReference ?? null,
    };
  }
  return { typeName: descriptor.typeName, memoryReference: null };
}

export function isLiteralSyntax(expression: Expression | null | undefined): boolean {
  return !expression || expression.type === "Literal";
}

export function getLiteralValue(value: WrappedInputValue): unknown {
  return value.expression?.value;
}

/**
 * Builds an updated wrapped-input value with a new literal cell. Keeps the
 * existing syntax type when present; otherwise defaults to "Literal".
 */
export function withLiteralValue(prev: WrappedInputValue, next: unknown): WrappedInputValue {
  const type = prev.expression?.type ?? "Literal";
  return {
    typeName: prev.typeName,
    expression: { type, value: next },
    memoryReference: prev.memoryReference ?? null,
  };
}

export function withSyntax(prev: WrappedInputValue, syntax: ExpressionSyntax | string): WrappedInputValue {
  return {
    typeName: prev.typeName,
    expression: { type: syntax, value: prev.expression?.value ?? "" },
    memoryReference: prev.memoryReference ?? null,
  };
}

/**
 * Write both the expression syntax AND its value at once. Used by pickers
 * whose UI hint identifies the syntax (variable-picker → "Variable",
 * input-picker → "Input") so the binding doesn't accidentally fall back to
 * "Literal" when the input has no prior expression. `withLiteralValue`
 * preserves whatever syntax already exists, which is the wrong default for
 * these pickers when the slot is empty.
 */
export function withSyntaxAndValue(
  prev: WrappedInputValue,
  syntax: ExpressionSyntax | string,
  value: unknown,
): WrappedInputValue {
  return {
    typeName: prev.typeName,
    expression: { type: syntax, value },
    memoryReference: prev.memoryReference ?? null,
  };
}

/**
 * Fallback descriptors used when the backend catalog hasn't loaded yet (or
 * the request failed). Matches Blazor's seed set; the live catalog always
 * wins. Note `Variable` / `Input` are picker syntaxes (no MonacoLanguage),
 * the rest are Monaco-driven.
 */
export const FALLBACK_EXPRESSION_DESCRIPTORS: ReadonlyArray<{
  type: string;
  displayName: string;
  isBrowsable: boolean;
  monacoLanguage?: string;
}> = [
  { type: "Literal", displayName: "Literal", isBrowsable: true },
  { type: "JavaScript", displayName: "JavaScript", isBrowsable: true, monacoLanguage: "javascript" },
  { type: "C#", displayName: "C#", isBrowsable: true, monacoLanguage: "csharp" },
  { type: "Liquid", displayName: "Liquid", isBrowsable: true, monacoLanguage: "liquid" },
  { type: "Python", displayName: "Python", isBrowsable: true, monacoLanguage: "python" },
  { type: "Object", displayName: "Object", isBrowsable: true, monacoLanguage: "json" },
  { type: "SQL", displayName: "SQL", isBrowsable: true, monacoLanguage: "sql" },
  { type: "Variable", displayName: "Variable", isBrowsable: true },
  { type: "Input", displayName: "Input", isBrowsable: true },
];

/** Extract the Monaco language for a descriptor (case-insensitive lookup). */
export function monacoLanguageOf(
  descriptor:
    | { properties?: Record<string, unknown> | null; monacoLanguage?: string }
    | undefined
    | null,
): string | undefined {
  if (!descriptor) return undefined;
  if ("monacoLanguage" in descriptor && typeof descriptor.monacoLanguage === "string") {
    return descriptor.monacoLanguage;
  }
  const props = descriptor.properties;
  if (!props) return undefined;
  for (const [k, v] of Object.entries(props)) {
    if (k.toLowerCase() === "monacolanguage" && typeof v === "string") return v;
  }
  return undefined;
}

/**
 * @deprecated Kept for backwards compatibility. New code should use the
 * `useExpressionDescriptors()` hook + `monacoLanguageOf()` instead.
 */
export const KNOWN_SYNTAXES: { value: ExpressionSyntax; label: string; code?: boolean }[] = [
  { value: "Literal", label: "Literal" },
  { value: "JavaScript", label: "JavaScript", code: true },
  { value: "Liquid", label: "Liquid", code: true },
  { value: "Object", label: "Object (JSON)", code: true },
  { value: "Variable", label: "Variable" },
  { value: "Input", label: "Input" },
];

/** @deprecated Use `monacoLanguageOf(descriptor)` instead. */
export function isCodeSyntax(syntax: string | undefined | null): boolean {
  if (!syntax) return false;
  const fallback = FALLBACK_EXPRESSION_DESCRIPTORS.find((d) => d.type === syntax);
  return !!fallback?.monacoLanguage;
}
