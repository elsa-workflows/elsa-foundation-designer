/**
 * Public extension surface for elsa-studio-next. Mirrors the registration
 * pattern of the Blazor studio's DI providers (IActivityDisplaySettingsRegistry,
 * IActivityPortService, IUIHintHandler, ICreateWorkflowDialogComponentProvider)
 * so plugins can wire in custom activities without forking internals.
 *
 * Call these once during your app's startup (e.g. in a top-level client
 * component) — registrations are global to the process.
 *
 * Example
 * -------
 * ```ts
 * import { Bot } from "lucide-react";
 * import {
 *   registerActivityDisplay,
 *   registerPortProvider,
 *   registerHint,
 * } from "@/lib/elsa/extension";
 *
 * registerActivityDisplay("Acme.LlmCall", { color: "#a855f7", icon: Bot });
 * registerPortProvider("LlmCall", {
 *   getChildren: (a) => (Array.isArray(a.steps) ? a.steps : []),
 *   setChildren: (a, _port, children) => ({ ...a, steps: children }),
 * });
 * registerHint("llm-prompt", MyPromptEditor);
 * ```
 */

export {
  registerActivityDisplay,
  registerCategoryDisplay,
  displayFor,
  tintFor,
  type ActivityDisplay,
} from "@/features/workflows/activity-display";

export {
  registerPortProvider,
  getEmbeddedChildren,
  setEmbeddedChildren,
  type PortProvider,
} from "@/features/workflows/embedded-ports";

export {
  registerHint,
  resolveHint,
} from "@/features/workflows/activity-properties/hints/registry";

export type { HintContext } from "@/features/workflows/activity-properties/hint-context";

// -- Late-binding providers -----------------------------------------------
//
// Slots for the three Blazor extension-point families that don't have a
// natural single-registration shape: an app can override the *strategy*
// behind a UI surface (which dialog component to render, which list of
// incident strategies to show, which observer transport to use).
//
// Each slot defaults to a built-in implementation; calling the setter
// overrides it process-wide. Apps wire these once in a root layout's
// client boundary.

import type { ComponentType } from "react";

/** Custom workflow-instance live-update transport (defaults to SignalR). */
export type WorkflowInstanceObserver = {
  /** Subscribe to a single instance; returns a teardown callback. */
  subscribe: (
    instanceId: string,
    onChange: () => void,
  ) => () => void;
};
let observerFactory: (() => WorkflowInstanceObserver) | null = null;
export function registerWorkflowInstanceObserver(
  factory: () => WorkflowInstanceObserver,
): void {
  observerFactory = factory;
}
export function getWorkflowInstanceObserverFactory():
  | (() => WorkflowInstanceObserver)
  | null {
  return observerFactory;
}

/** Replace the default "New workflow" dialog. */
let createWorkflowDialog: ComponentType<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
}> | null = null;
export function registerCreateWorkflowDialog(
  component: ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void }>,
): void {
  createWorkflowDialog = component;
}
export function getCreateWorkflowDialogOverride() {
  return createWorkflowDialog;
}

/**
 * Provide an extra catalog of incident strategies (e.g. for offline /
 * test environments where the backend doesn't expose them).
 */
let incidentStrategiesOverride:
  | (() => Array<{ typeName: string; displayName: string; description?: string | null }>)
  | null = null;
export function registerIncidentStrategies(
  provider: () => Array<{ typeName: string; displayName: string; description?: string | null }>,
): void {
  incidentStrategiesOverride = provider;
}
export function getIncidentStrategiesOverride() {
  return incidentStrategiesOverride;
}

/**
 * Provide an extra catalog of activity descriptors. Used to surface
 * synthetic activity types that don't exist on the server — handy for
 * stubbing during local development.
 */
let activityDescriptorsOverride:
  | (() => Array<{ typeName: string; displayName: string; category: string }>)
  | null = null;
export function registerActivityDescriptors(
  provider: () => Array<{ typeName: string; displayName: string; category: string }>,
): void {
  activityDescriptorsOverride = provider;
}
export function getActivityDescriptorsOverride() {
  return activityDescriptorsOverride;
}
