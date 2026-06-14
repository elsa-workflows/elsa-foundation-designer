import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  Box,
  Braces,
  Calendar,
  CheckCircle2,
  Cloud,
  CloudDownload,
  CornerLeftUp,
  FileDown,
  FileEdit,
  Flag,
  GitBranch,
  GitCommit,
  GitFork,
  GitMerge,
  Globe,
  HelpCircle,
  Hexagon,
  Hourglass,
  Inbox,
  Link2,
  type LucideIcon,
  Mail,
  Pencil,
  Play,
  Repeat,
  ScrollText,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  Shuffle,
  Terminal,
  Timer,
  Type,
  Workflow,
  Zap,
} from "lucide-react";

import type { ActivityDescriptor } from "@/lib/api/types";

/**
 * Visual settings for an activity type. Mirrors the Blazor studio's
 * DefaultActivityDisplaySettingsProvider so a port has familiar visuals.
 */
export type ActivityDisplay = {
  color: string;
  icon: LucideIcon;
};

/** Tailwind-friendly hex palette, lifted from the old studio's `DefaultActivityColors`. */
const PALETTE = {
  branching: "#06b6d4", // cyan-500
  composition: "#f97316", // orange-500
  console: "#0369a1", // sky-700
  diagnostics: "#ec4899", // pink-500
  email: "#f59e0b", // amber-500 (the old amber-300 was too pale on a colored bg)
  flowchart: "#06b6d4",
  http: "#14b8a6", // teal-500
  looping: "#6366f1", // indigo-500
  primitives: "#3b82f6", // blue-500
  scripting: "#22c55e", // green-500
  timer: "#d946ef", // fuchsia-500
  azure: "#a21caf", // fuchsia-700
  notFound: "#ef4444", // red-500
  default: "#3b82f6",
} as const;

/**
 * Per-typeName overrides. Anything not listed here falls back to the
 * category color and a generic icon (see `displayFor`).
 */
const TYPE_DISPLAY: Record<string, ActivityDisplay> = {
  // Not found
  "Elsa.NotFoundActivity": { color: PALETTE.notFound, icon: AlertTriangle },

  // Branching
  "Elsa.If": { color: PALETTE.branching, icon: HelpCircle },
  "Elsa.FlowDecision": { color: PALETTE.branching, icon: HelpCircle },
  "Elsa.Switch": { color: PALETTE.branching, icon: Shuffle },
  "Elsa.FlowSwitch": { color: PALETTE.branching, icon: Shuffle },
  "Elsa.FlowJoin": { color: PALETTE.branching, icon: GitMerge },
  "Elsa.FlowFork": { color: PALETTE.branching, icon: GitFork },

  // Composition
  "Elsa.Complete": { color: PALETTE.composition, icon: CheckCircle2 },
  "Elsa.SetOutput": { color: PALETTE.composition, icon: Share2 },
  "Elsa.DispatchWorkflow": { color: PALETTE.composition, icon: GitCommit },
  "Elsa.BulkDispatchWorkflows": { color: PALETTE.composition, icon: Share2 },
  "Elsa.ExecuteWorkflow": { color: PALETTE.composition, icon: Terminal },

  // Console
  "Elsa.WriteLine": { color: PALETTE.console, icon: Pencil },
  "Elsa.ReadLine": { color: PALETTE.console, icon: AlignLeft },

  // Email
  "Elsa.SendEmail": { color: PALETTE.email, icon: Mail },

  // Flowchart
  "Elsa.Flowchart": { color: PALETTE.flowchart, icon: Workflow },
  "Elsa.FlowNode": { color: PALETTE.flowchart, icon: Hexagon },
  "Elsa.Start": { color: PALETTE.flowchart, icon: Play },
  "Elsa.End": { color: PALETTE.flowchart, icon: Flag },

  // HTTP
  "Elsa.HttpEndpoint": { color: PALETTE.http, icon: Cloud },
  "Elsa.WriteHttpResponse": { color: PALETTE.http, icon: FileEdit },
  "Elsa.WriteFileHttpResponse": { color: PALETTE.http, icon: FileDown },
  "Elsa.SendHttpRequest": { color: PALETTE.http, icon: Globe },
  "Elsa.FlowSendHttpRequest": { color: PALETTE.http, icon: Globe },
  "Elsa.DownloadHttpFile": { color: PALETTE.http, icon: CloudDownload },

  // Looping
  "Elsa.While": { color: PALETTE.looping, icon: Repeat },
  "Elsa.ForEach": { color: PALETTE.looping, icon: Repeat },
  "Elsa.For": { color: PALETTE.looping, icon: Repeat },
  "Elsa.ParallelForEach": { color: PALETTE.looping, icon: Repeat },
  "Elsa.Break": { color: PALETTE.looping, icon: CornerLeftUp },

  // Primitives
  "Elsa.SetVariable": { color: PALETTE.primitives, icon: Pencil },
  "Elsa.SetName": { color: PALETTE.primitives, icon: Type },
  "Elsa.Finish": { color: PALETTE.primitives, icon: ShieldCheck },
  "Elsa.Fault": { color: PALETTE.primitives, icon: AlertCircle },
  "Elsa.Correlate": { color: PALETTE.primitives, icon: Link2 },
  "Elsa.RunTask": { color: PALETTE.primitives, icon: Settings },
  "Elsa.PublishEvent": { color: PALETTE.primitives, icon: Zap },
  "Elsa.Event": { color: PALETTE.primitives, icon: Zap },

  // Timers
  "Elsa.Timer": { color: PALETTE.timer, icon: Timer },
  "Elsa.Cron": { color: PALETTE.timer, icon: Timer },
  "Elsa.Delay": { color: PALETTE.timer, icon: Hourglass },
  "Elsa.StartAt": { color: PALETTE.timer, icon: Calendar },

  // Scripting
  "Elsa.RunJavaScript": { color: PALETTE.scripting, icon: Braces },

  // Diagnostics
  "Elsa.Log": { color: PALETTE.diagnostics, icon: ScrollText },

  // Azure Service Bus
  "Elsa.AzureServiceBus.MessageReceived": { color: PALETTE.azure, icon: Inbox },
  "Elsa.AzureServiceBus.SendMessage": { color: PALETTE.azure, icon: Send },
};

/** Lower-cased category → palette color. Generic fallback when no per-type override exists. */
const CATEGORY_COLORS: Record<string, string> = {
  branching: PALETTE.branching,
  composition: PALETTE.composition,
  console: PALETTE.console,
  diagnostics: PALETTE.diagnostics,
  email: PALETTE.email,
  flowchart: PALETTE.flowchart,
  http: PALETTE.http,
  looping: PALETTE.looping,
  primitives: PALETTE.primitives,
  scripting: PALETTE.scripting,
  timer: PALETTE.timer,
  timers: PALETTE.timer,
  workflows: PALETTE.composition,
  messaging: PALETTE.azure,
};

/** Lower-cased category → fallback icon when the specific type isn't mapped. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  branching: GitBranch,
  composition: Workflow,
  console: Terminal,
  diagnostics: ScrollText,
  email: Mail,
  flowchart: Workflow,
  http: Globe,
  looping: Repeat,
  primitives: Box,
  scripting: Braces,
  timer: Timer,
  timers: Timer,
  workflows: Workflow,
  messaging: Send,
};

/**
 * Resolve visual settings for an activity. Looks up the explicit type map
 * first, then falls back to the category, then to neutral defaults.
 */
export function displayFor(
  typeName: string | undefined,
  descriptor?: Pick<ActivityDescriptor, "category"> | null,
): ActivityDisplay {
  if (typeName && TYPE_DISPLAY[typeName]) return TYPE_DISPLAY[typeName];
  const cat = descriptor?.category?.toLowerCase();
  return {
    color: cat ? (CATEGORY_COLORS[cat] ?? PALETTE.default) : PALETTE.default,
    icon: cat ? (CATEGORY_ICONS[cat] ?? Box) : Box,
  };
}

/**
 * Register or override the visual for a specific activity type. Plugins call
 * this at startup so their custom activities pick up canvas / palette
 * styling without forking this file.
 */
export function registerActivityDisplay(
  typeName: string,
  display: ActivityDisplay,
  options: { overwrite?: boolean } = {},
): void {
  if (TYPE_DISPLAY[typeName] && !options.overwrite) return;
  TYPE_DISPLAY[typeName] = display;
}

/** Register or override the visual for an activity *category*. */
export function registerCategoryDisplay(
  category: string,
  display: ActivityDisplay,
  options: { overwrite?: boolean } = {},
): void {
  const key = category.toLowerCase();
  if (!options.overwrite && CATEGORY_COLORS[key]) return;
  CATEGORY_COLORS[key] = display.color;
  CATEGORY_ICONS[key] = display.icon;
}

/**
 * Pre-computes a soft, low-saturation background tint that still reads on
 * white. Used for the icon halo behind action activities.
 */
export function tintFor(color: string): string {
  // `color-mix` is broadly supported; produces a 12%-opacity tint over the
  // current surface color so dark mode keeps a reasonable hue.
  return `color-mix(in oklch, ${color} 14%, transparent)`;
}
