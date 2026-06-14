import type {
  ActivityJson,
  StateMachineState,
  StateMachineTransition,
} from "@/lib/api/types";

export type StateMachineValidationSeverity = "error" | "warning";

export type StateMachineValidationIssue = {
  severity: StateMachineValidationSeverity;
  /** Stable identifier — useful for testing + dedup. */
  code: string;
  message: string;
  /** Human-readable target (state name, transition label, etc.). */
  target?: string;
};

/**
 * Port of Blazor's `StateMachineValidator` (Services/StateMachineValidator.cs).
 * Pure function — given a State Machine root, returns the list of issues that
 * would block save or warrant a warning chip. Designed to be called
 * frequently (on every edit) so the SM canvas can show inline issue counts.
 *
 * Activity-slot validation (entry / exit / trigger / action / condition) is
 * lighter than the Blazor version: it only checks that slot objects look
 * like activities (have a `type`) since the deep nodeId / id checks rely on
 * .NET-side normalization that hasn't shipped client-side yet.
 */
export function validateStateMachineRoot(
  root: ActivityJson,
): StateMachineValidationIssue[] {
  if (typeof root.type !== "string") return [];
  const isStateMachine =
    root.type === "Elsa.StateMachine" || root.type.endsWith(".StateMachine");
  if (!isStateMachine) return [];

  const states = (root.states as StateMachineState[] | undefined) ?? [];
  const transitions =
    (root.transitions as StateMachineTransition[] | undefined) ?? [];
  const initialState =
    typeof root.initialState === "string" ? root.initialState : null;
  const currentState =
    typeof root.currentState === "string" ? root.currentState : null;

  const issues: StateMachineValidationIssue[] = [];
  const nameCounts = new Map<string, number>();
  for (const st of states) {
    if (typeof st.name === "string") {
      nameCounts.set(st.name, (nameCounts.get(st.name) ?? 0) + 1);
    }
  }

  // ----- States ----------------------------------------------------------
  for (const state of states) {
    if (!state.name || !state.name.trim()) {
      issues.push({
        severity: "error",
        code: "EmptyStateName",
        message: "State name is required.",
        target: "state",
      });
    } else if ((nameCounts.get(state.name) ?? 0) > 1) {
      issues.push({
        severity: "error",
        code: "DuplicateStateName",
        message: `State name '${state.name}' is used more than once.`,
        target: state.name,
      });
    }
    addActivitySlotIssue(issues, state.entry, `${state.name}.entry`);
    addActivitySlotIssue(issues, state.exit, `${state.name}.exit`);
  }

  // ----- Transitions -----------------------------------------------------
  const identityCounts = new Map<string, number>();
  for (const t of transitions) {
    const id = transitionIdentity(t);
    identityCounts.set(id, (identityCounts.get(id) ?? 0) + 1);
  }
  const reportedDuplicates = new Set<string>();
  for (const transition of transitions) {
    const target = transitionTarget(transition);

    if (!transition.from || !transition.from.trim()) {
      issues.push({
        severity: "error",
        code: "MissingTransitionSource",
        message: "Transition source state is required.",
        target,
      });
    } else if (!nameCounts.has(transition.from)) {
      issues.push({
        severity: "error",
        code: "MissingTransitionSourceState",
        message: `Transition source state '${transition.from}' does not exist.`,
        target,
      });
    } else if ((nameCounts.get(transition.from) ?? 0) > 1) {
      issues.push({
        severity: "error",
        code: "AmbiguousTransitionSourceState",
        message: `Transition source state '${transition.from}' matches multiple states.`,
        target,
      });
    }

    if (!transition.to || !transition.to.trim()) {
      issues.push({
        severity: "error",
        code: "MissingTransitionTarget",
        message: "Transition target state is required.",
        target,
      });
    } else if (!nameCounts.has(transition.to)) {
      issues.push({
        severity: "error",
        code: "MissingTransitionTargetState",
        message: `Transition target state '${transition.to}' does not exist.`,
        target,
      });
    } else if ((nameCounts.get(transition.to) ?? 0) > 1) {
      issues.push({
        severity: "error",
        code: "AmbiguousTransitionTargetState",
        message: `Transition target state '${transition.to}' matches multiple states.`,
        target,
      });
    }

    const id = transitionIdentity(transition);
    if ((identityCounts.get(id) ?? 0) > 1 && !reportedDuplicates.has(id)) {
      reportedDuplicates.add(id);
      issues.push({
        severity: "error",
        code: "DuplicateTransitionIdentity",
        message: `Transition '${target}' has the same name, source, and target as another transition.`,
        target,
      });
    }

    addActivitySlotIssue(issues, transition.trigger, `${target}.trigger`);
    addActivitySlotIssue(issues, transition.action, `${target}.action`);
  }

  // ----- Cross-cutting refs ----------------------------------------------
  if (initialState && initialState.trim() && !nameCounts.has(initialState)) {
    issues.push({
      severity: "warning",
      code: "MissingInitialState",
      message: `Initial state '${initialState}' does not exist.`,
      target: initialState,
    });
  }
  if (currentState && currentState.trim() && !nameCounts.has(currentState)) {
    issues.push({
      severity: "warning",
      code: "MissingCurrentState",
      message: `Current state '${currentState}' does not exist.`,
      target: currentState,
    });
  }

  return issues;
}

/** Human-readable transition label for issue messages. */
function transitionTarget(t: StateMachineTransition): string {
  return (
    normalizeOptional(t.displayName) ??
    normalizeOptional(t.name) ??
    `${t.from}->${t.to}`
  );
}

/** Identity key for duplicate-transition detection — name + endpoints. */
function transitionIdentity(t: StateMachineTransition): string {
  return `${t.name ?? ""}|${t.from}|${t.to}`;
}

function normalizeOptional(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Validate that an optional activity slot is either absent or a well-formed
 * activity object (carries a `type`). Looser than Blazor's version, which also
 * verifies `id` / `nodeId` populated by the server-side normalization.
 */
function addActivitySlotIssue(
  issues: StateMachineValidationIssue[],
  slot: unknown,
  target: string,
): void {
  if (slot == null) return;
  if (typeof slot !== "object") {
    issues.push({
      severity: "error",
      code: "InvalidActivitySlot",
      message: `Slot '${target}' must contain an activity object.`,
      target,
    });
    return;
  }
  const obj = slot as Record<string, unknown>;
  if (typeof obj.type !== "string" || obj.type.trim().length === 0) {
    issues.push({
      severity: "error",
      code: "InvalidActivitySlot",
      message: `Slot '${target}' must contain an activity object.`,
      target,
    });
  }
}
