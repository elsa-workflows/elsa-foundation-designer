import {
  ArrowUpCircle,
  Ban,
  PencilLine,
  PlayCircle,
  XCircle,
  type LucideIcon,
} from "lucide-react";

/** Where an alteration applies. Drives which section of the Selection tab surfaces it. */
export type AlterationTargetKind = "Instance" | "Activity" | "Variable";

/** Editor kind for a single configurable field on an alteration. */
export type AlterationFieldKind =
  | "Text"
  | "Integer"
  | "Json"
  | "VariablePicker"
  | "VersionPicker";

export type AlterationTint = "rose" | "amber" | "violet" | "sky" | "emerald";

export type AlterationFieldSpec = {
  /** JSON property name on the wire — camelCase. */
  key: string;
  displayName: string;
  kind: AlterationFieldKind;
  required?: boolean;
  helperText?: string;
};

export type AlterationDescriptor = {
  typeId: string;
  displayName: string;
  description: string;
  target: AlterationTargetKind;
  icon: LucideIcon;
  tint: AlterationTint;
  fields?: AlterationFieldSpec[];
};

/**
 * Hardcoded catalog — mirrors AlterationCatalog.cs in the Blazor module. Once
 * the server exposes a discovery endpoint this file can be swapped for a hook
 * without touching call sites.
 */
export const ALTERATION_CATALOG: AlterationDescriptor[] = [
  {
    typeId: "Cancel",
    displayName: "Cancel workflow",
    description: "Cancel the running workflow instance.",
    target: "Instance",
    icon: XCircle,
    tint: "rose",
  },
  {
    typeId: "CancelActivity",
    displayName: "Cancel activity",
    description: "Cancel the selected activity.",
    target: "Activity",
    icon: Ban,
    tint: "amber",
  },
  {
    typeId: "ScheduleActivity",
    displayName: "Schedule activity",
    description: "Schedule the selected activity to run again.",
    target: "Activity",
    icon: PlayCircle,
    tint: "sky",
  },
  {
    typeId: "ModifyVariable",
    displayName: "Modify variable",
    description: "Change the value of a workflow variable.",
    target: "Variable",
    icon: PencilLine,
    tint: "violet",
    fields: [
      {
        key: "variableId",
        displayName: "Variable",
        kind: "VariablePicker",
        required: true,
      },
      {
        key: "value",
        displayName: "New value",
        kind: "Json",
        required: true,
        helperText: "Any JSON literal. Strings must be quoted.",
      },
    ],
  },
  {
    typeId: "Migrate",
    displayName: "Migrate to newer version",
    description: "Move the running instance to a different published version.",
    target: "Instance",
    icon: ArrowUpCircle,
    tint: "emerald",
    fields: [
      {
        key: "targetVersion",
        displayName: "Target version",
        kind: "VersionPicker",
        required: true,
      },
    ],
  },
];

export function descriptorById(typeId: string): AlterationDescriptor | undefined {
  return ALTERATION_CATALOG.find((d) => d.typeId === typeId);
}

export function descriptorsForTarget(
  target: AlterationTargetKind,
): AlterationDescriptor[] {
  return ALTERATION_CATALOG.filter((d) => d.target === target);
}

const TINT_CLASSES: Record<
  AlterationTint,
  { bg: string; fg: string; accent: string }
> = {
  rose: {
    bg: "bg-rose-500/12",
    fg: "text-rose-600 dark:text-rose-400",
    accent: "bg-rose-500",
  },
  amber: {
    bg: "bg-amber-500/12",
    fg: "text-amber-600 dark:text-amber-400",
    accent: "bg-amber-500",
  },
  violet: {
    bg: "bg-violet-500/12",
    fg: "text-violet-600 dark:text-violet-400",
    accent: "bg-violet-500",
  },
  sky: {
    bg: "bg-sky-500/12",
    fg: "text-sky-600 dark:text-sky-400",
    accent: "bg-sky-500",
  },
  emerald: {
    bg: "bg-emerald-500/12",
    fg: "text-emerald-600 dark:text-emerald-400",
    accent: "bg-emerald-500",
  },
};

export function tintClasses(tint: AlterationTint) {
  return TINT_CLASSES[tint];
}
