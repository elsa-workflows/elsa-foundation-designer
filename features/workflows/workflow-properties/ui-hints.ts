/**
 * The set of UI hints a workflow input can declare. Hardcoded — same as
 * the Blazor studio's EditInputDialog.cs (with its "TODO: get from the
 * backend" comment). Order matches the old studio's dropdown.
 */
export type KnownUiHint = {
  /** Wire value stored on `InputDefinition.uiHint`. */
  value: string;
  /** Friendly label shown in the dropdown. */
  label: string;
  /** Short description rendered under the label. */
  description?: string;
};

export const KNOWN_UI_HINTS: readonly KnownUiHint[] = [
  { value: "singleline", label: "Single line", description: "A short, single-line text field." },
  { value: "multiline", label: "Multi-line", description: "A larger text area." },
  { value: "checkbox", label: "Checkbox", description: "Boolean toggle." },
  { value: "checklist", label: "Check list", description: "Multi-select list of checkboxes." },
  { value: "radiolist", label: "Radio list", description: "Single-select list of radios." },
  { value: "dropdown", label: "Dropdown", description: "Single-select dropdown." },
  { value: "multitext", label: "Multi text", description: "List of free-form text values." },
  { value: "code-editor", label: "Code editor", description: "Code editor with syntax highlighting." },
  { value: "variable-picker", label: "Variable picker", description: "Pick from workflow variables." },
  {
    value: "workflow-definition-picker",
    label: "Workflow picker",
    description: "Pick from registered workflow definitions.",
  },
  { value: "output-picker", label: "Output picker", description: "Pick from workflow outputs." },
  { value: "outcome-picker", label: "Outcome picker", description: "Pick from workflow outcomes." },
  { value: "json-editor", label: "JSON editor", description: "Edit structured JSON content." },
];

const HINT_BY_VALUE = new Map(KNOWN_UI_HINTS.map((h) => [h.value, h] as const));

export function labelForUiHint(value: string | undefined | null): string {
  if (!value) return "—";
  return HINT_BY_VALUE.get(value)?.label ?? value;
}
