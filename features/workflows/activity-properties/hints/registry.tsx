"use client";

import type { ComponentType } from "react";

import { CheckListHint } from "@/features/workflows/activity-properties/hints/check-list";
import { CheckboxHint } from "@/features/workflows/activity-properties/hints/checkbox";
import {
  CodeEditorHint,
  ExpressionEditorHint,
  JsonEditorHint,
} from "@/features/workflows/activity-properties/hints/code-editor";
import { DateTimePickerHint } from "@/features/workflows/activity-properties/hints/datetime-picker";
import { DictionaryHint } from "@/features/workflows/activity-properties/hints/dictionary";
import { DropdownHint } from "@/features/workflows/activity-properties/hints/dropdown";
import { DynamicOutcomesHint } from "@/features/workflows/activity-properties/hints/dynamic-outcomes";
import { FallbackHint } from "@/features/workflows/activity-properties/hints/fallback";
import { HttpStatusCodesHint } from "@/features/workflows/activity-properties/hints/http-status-codes";
import { MultiLineHint } from "@/features/workflows/activity-properties/hints/multi-line";
import { MultiTextHint } from "@/features/workflows/activity-properties/hints/multi-text";
import {
  InputPickerHint,
  OutcomePickerHint,
  OutputPickerHint,
  VariablePickerHint,
  WorkflowDefinitionPickerHint,
} from "@/features/workflows/activity-properties/hints/pickers";
import { RadioListHint } from "@/features/workflows/activity-properties/hints/radio-list";
import { SingleLineHint } from "@/features/workflows/activity-properties/hints/single-line";
import {
  FlowSwitchCasesHint,
  SwitchCasesHint,
} from "@/features/workflows/activity-properties/hints/switch-cases";
import { TypePickerHint } from "@/features/workflows/activity-properties/hints/type-picker";
import type { HintContext } from "@/features/workflows/activity-properties/hint-context";

/** Mirrors `InputUIHints` in the Blazor studio. */
const REGISTRY: Record<string, ComponentType<{ ctx: HintContext }>> = {
  singleline: SingleLineHint,
  multiline: MultiLineHint,
  checkbox: CheckboxHint,
  checklist: CheckListHint,
  dropdown: DropdownHint,
  radiolist: RadioListHint,
  multitext: MultiTextHint,
  dictionary: DictionaryHint,
  "datetime-picker": DateTimePickerHint,
  "code-editor": CodeEditorHint,
  "expression-editor": ExpressionEditorHint,
  "json-editor": JsonEditorHint,
  "variable-picker": VariablePickerHint,
  "outcome-picker": OutcomePickerHint,
  "workflow-definition-picker": WorkflowDefinitionPickerHint,
  "input-picker": InputPickerHint,
  "output-picker": OutputPickerHint,
  "type-picker": TypePickerHint,
  "http-status-codes": HttpStatusCodesHint,
  "dynamic-outcomes": DynamicOutcomesHint,
  "switch-editor": SwitchCasesHint,
  "flow-switch-editor": FlowSwitchCasesHint,
};

/** Resolve a hint string to its renderer; falls back to a generic text input. */
export function resolveHint(uiHint: string | undefined | null): ComponentType<{ ctx: HintContext }> {
  if (!uiHint) return FallbackHint;
  return REGISTRY[uiHint.toLowerCase()] ?? FallbackHint;
}

/**
 * Register a UI-hint renderer at runtime. The first registration wins on
 * conflict so apps can override a built-in by registering their own first;
 * pass `{ overwrite: true }` to force replacement.
 */
export function registerHint(
  name: string,
  component: ComponentType<{ ctx: HintContext }>,
  options: { overwrite?: boolean } = {},
): void {
  const key = name.toLowerCase();
  if (REGISTRY[key] && !options.overwrite) return;
  REGISTRY[key] = component;
}
