"use client";

import { create } from "zustand";

import { isSequenceRoot } from "@/features/workflows/build-graph";
import {
  getEmbeddedChildren,
  setEmbeddedChildren,
} from "@/features/workflows/embedded-ports";
import { layoutRootSequence } from "@/features/workflows/sequence-layout";
import type {
  ActivityJson,
  StateMachineState,
  StateMachineTransition,
  ValidationErrors,
  WorkflowDefinition,
} from "@/lib/api/types";

export type EditorTab = "designer" | "code" | "properties";

/** Sub-tab inside the workflow Properties panel. */
export type PropertiesSubTab = "info" | "variables" | "io" | "versions";

/** One step of "drilling into" a composite activity. */
export type ContainerFrame = {
  /** Activity id of the container the user drilled into. */
  id: string;
  /**
   * When set, the active container is the child attached to this port on
   * the activity identified by `id` (e.g. `if.then`, `forEach.body`). When
   * unset, the active container is the activity itself, drilled into as a
   * direct Flowchart-in-Flowchart child of its parent.
   */
  portName?: string;
  /** Cached display label used by the breadcrumb. */
  displayName: string;
};

/** A point-in-time snapshot of the user-visible editor state. */
type Snapshot = {
  root: ActivityJson;
  selectedActivityId: string | null;
};

const MAX_HISTORY = 50;

type EditorState = {
  /** The current in-memory definition; null until loaded. */
  definition: WorkflowDefinition | null;
  /** Original definition fetched from the server, untouched. */
  initial: WorkflowDefinition | null;
  /** Whether the user has made unsaved edits. */
  isDirty: boolean;
  /** Activity id currently selected in the canvas (drives the right panel). */
  selectedActivityId: string | null;
  /**
   * Index of the State Machine transition currently selected on the canvas,
   * or null. State machines select edges (not activities) — keeping this in a
   * separate slot avoids collisions with `selectedActivityId` and lets the
   * properties panel render a transition-specific card. Resets whenever a
   * state/activity is selected and vice versa.
   */
  selectedTransitionIndex: number | null;
  /** Auto-save toggle in the toolbar. */
  autoSave: boolean;
  /** Active center tab. */
  tab: EditorTab;
  /** Active sub-tab inside the Properties panel. */
  propertiesSubTab: PropertiesSubTab;
  /** Whether the activity palette (left pane) is collapsed to a thin rail. */
  paletteCollapsed: boolean;
  /** Width of the activity inspector (right pane) in px. User-resizable. */
  inspectorWidth: number;
  /**
   * When true, the inspector takes ~55% of the editor area so users have
   * comfortable room to write long expressions / code / JSON. Toggle from
   * the inspector header.
   */
  inspectorFocus: boolean;
  /** Undo history. Oldest at index 0. */
  past: Snapshot[];
  /** Redo history. Most-recently-undone at index 0. */
  future: Snapshot[];
  /**
   * Stack of nested containers the user has drilled into. Empty array means
   * the canvas is showing the workflow root. The breadcrumb above the canvas
   * lets users jump back to any ancestor frame.
   */
  containerStack: ContainerFrame[];
  /**
   * The most-recent validation-error map returned by save/publish. `null` when
   * there are no outstanding errors. Mirrors Elsa's `Root.Activities[<id>]…`
   * field paths so `validation-panel.tsx` can jump to the offending activity.
   */
  validationErrors: ValidationErrors | null;

  // ------- actions -------
  hydrate: (def: WorkflowDefinition) => void;
  reset: () => void;
  setDefinition: (updater: (prev: WorkflowDefinition) => WorkflowDefinition) => void;
  setRoot: (root: ActivityJson) => void;
  /** Replace the activity at the deepest container frame; rebuilds the spine. */
  setContainerRoot: (root: ActivityJson) => void;
  setSelectedActivityId: (id: string | null) => void;
  setSelectedTransitionIndex: (index: number | null) => void;
  setAutoSave: (on: boolean) => void;
  setTab: (tab: EditorTab) => void;
  setPropertiesSubTab: (sub: PropertiesSubTab) => void;
  setPaletteCollapsed: (collapsed: boolean) => void;
  togglePaletteCollapsed: () => void;
  setInspectorWidth: (px: number) => void;
  toggleInspectorFocus: () => void;
  setInspectorFocus: (on: boolean) => void;
  markClean: (def?: WorkflowDefinition) => void;
  /** Capture the current root + selection so the next mutation can be undone. */
  pushSnapshot: () => void;
  undo: () => void;
  redo: () => void;
  /** Remove an activity from the root by id. Snapshots before mutating. */
  removeActivityById: (id: string) => void;
  /** Duplicate an activity by id, offsetting the new node's designer position. */
  duplicateActivityById: (id: string) => void;
  /**
   * Move a Sequence child up or down in `activities[]`. Re-layouts so the
   * visual order matches the new array index. No-op when the active root
   * isn't a Sequence, the activity isn't found, or the move would push past
   * the array boundary.
   */
  moveSequenceActivity: (id: string, direction: "earlier" | "later") => void;
  /** Flip the `canStartWorkflow` flag on an activity. */
  toggleCanStartWorkflow: (id: string) => void;
  /** Push a frame onto the container stack and clear the selection. */
  enterContainer: (id: string, displayName: string) => void;
  /** Push a port-attached frame (e.g. `If.Then`) and clear the selection. */
  enterContainerByPort: (
    activityId: string,
    portName: string,
    displayName: string,
  ) => void;
  /** Drop the last frame; no-op at the workflow root. */
  popContainer: () => void;
  /**
   * Truncate the container stack so `index` becomes the deepest frame.
   * `index === -1` means "jump back to the workflow root".
   */
  popToContainer: (index: number) => void;
  setValidationErrors: (errors: ValidationErrors | null) => void;
  clearValidationErrors: () => void;
  /**
   * Append a new state to a State Machine root. Auto-names the state (State1,
   * State2, …) to avoid collisions and sets it as `initialState` when the
   * machine was empty. No-op when the root isn't a State Machine.
   */
  addStateMachineState: (positionHint?: { x: number; y: number }) => void;
  /**
   * Append a transition between two existing states. No-op when either
   * endpoint is missing or the root isn't a State Machine.
   */
  addStateMachineTransition: (from: string, to: string) => void;
  /**
   * Remove a state by name. Cascade-removes every transition that referred
   * to the state. Clears `initialState` / `currentState` when they pointed
   * at the removed state.
   */
  removeStateMachineState: (name: string) => void;
  /**
   * Rename a state. Cascades to `initialState`, `currentState`, and every
   * transition's `from` / `to`. No-op when the new name collides with an
   * existing state or the old name doesn't exist.
   */
  renameStateMachineState: (oldName: string, newName: string) => void;
  /**
   * Promote a state to `initialState`. No-op when the name doesn't exist.
   */
  setStateMachineInitialState: (name: string) => void;
  /**
   * Remove a transition by its index in `root.transitions[]`. The selection
   * slot is cleared when the removed transition was the active one.
   */
  removeStateMachineTransitionByIndex: (index: number) => void;
  /**
   * Patch fields on a transition (name / displayName / from / to). `from`
   * and `to` must reference existing states.
   */
  updateStateMachineTransition: (
    index: number,
    patch: Partial<{
      name: string | null;
      displayName: string | null;
      from: string;
      to: string;
      /**
       * `true` always fires; `false` never fires; `null` clears the condition
       * (same as `true` at runtime but represented absent in JSON).
       * Activity-typed conditions (expressions) are out of scope for this
       * setter — edit them via the slot drill-down once Phase C condition
       * editor ships.
       */
      condition: boolean | null;
    }>,
  ) => void;
};

export const useEditorStore = create<EditorState>((set) => ({
  definition: null,
  initial: null,
  isDirty: false,
  selectedActivityId: null,
  selectedTransitionIndex: null,
  autoSave: false,
  tab: "designer",
  propertiesSubTab: "info",
  paletteCollapsed: false,
  inspectorWidth: 420,
  inspectorFocus: false,
  past: [],
  future: [],
  containerStack: [],
  validationErrors: null,

  hydrate: (def) =>
    set({
      definition: def,
      initial: def,
      isDirty: false,
      selectedActivityId: null,
      selectedTransitionIndex: null,
      past: [],
      future: [],
      containerStack: [],
      validationErrors: null,
    }),

  reset: () =>
    set({
      definition: null,
      initial: null,
      isDirty: false,
      selectedActivityId: null,
      selectedTransitionIndex: null,
      tab: "designer",
      past: [],
      future: [],
      containerStack: [],
      validationErrors: null,
    }),

  setDefinition: (updater) =>
    set((s) =>
      s.definition
        ? { definition: updater(s.definition), isDirty: true }
        : s,
    ),

  setRoot: (root) =>
    set((s) =>
      s.definition
        ? { definition: { ...s.definition, root }, isDirty: true }
        : s,
    ),

  setContainerRoot: (containerRoot) =>
    set((s) => {
      if (!s.definition) return s;
      const nextRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        containerRoot,
      );
      return {
        definition: { ...s.definition, root: nextRoot },
        isDirty: true,
      };
    }),

  setSelectedActivityId: (id) =>
    set((s) =>
      id == null
        ? { selectedActivityId: null }
        : {
            selectedActivityId: id,
            // Selecting an activity/state clears any transition selection.
            selectedTransitionIndex:
              s.selectedTransitionIndex === null ? null : null,
          },
    ),
  setSelectedTransitionIndex: (index) =>
    set((s) =>
      index == null
        ? { selectedTransitionIndex: null }
        : {
            selectedTransitionIndex: index,
            // And vice versa — picking a transition clears the state pick.
            selectedActivityId: s.selectedActivityId === null ? null : null,
          },
    ),
  setAutoSave: (on) => set({ autoSave: on }),
  setTab: (tab) => set({ tab }),
  setPropertiesSubTab: (sub) => set({ propertiesSubTab: sub }),
  setPaletteCollapsed: (collapsed) => set({ paletteCollapsed: collapsed }),
  togglePaletteCollapsed: () =>
    set((s) => ({ paletteCollapsed: !s.paletteCollapsed })),
  setInspectorWidth: (px) =>
    set({ inspectorWidth: Math.max(280, Math.min(1200, Math.round(px))) }),
  toggleInspectorFocus: () =>
    set((s) => ({ inspectorFocus: !s.inspectorFocus })),
  setInspectorFocus: (on) => set({ inspectorFocus: on }),

  markClean: (def) =>
    set((s) => ({
      definition: def ?? s.definition,
      initial: def ?? s.definition,
      isDirty: false,
    })),

  pushSnapshot: () =>
    set((s) => {
      if (!s.definition) return s;
      const snap: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snap].slice(-MAX_HISTORY);
      return { past, future: [] };
    }),

  undo: () =>
    set((s) => {
      if (!s.definition || s.past.length === 0) return s;
      const past = [...s.past];
      const prev = past.pop()!;
      const current: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      return {
        past,
        future: [current, ...s.future].slice(0, MAX_HISTORY),
        definition: { ...s.definition, root: prev.root },
        selectedActivityId: prev.selectedActivityId,
        isDirty: true,
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.definition || s.future.length === 0) return s;
      const [next, ...future] = s.future;
      const current: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      return {
        past: [...s.past, current].slice(-MAX_HISTORY),
        future,
        definition: { ...s.definition, root: next.root },
        selectedActivityId: next.selectedActivityId,
        isDirty: true,
      };
    }),

  removeActivityById: (id) =>
    set((s) => {
      if (!s.definition) return s;
      const snap: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const nextRoot = removeActivityFromRoot(s.definition.root, id);
      return {
        past: [...s.past, snap].slice(-MAX_HISTORY),
        future: [],
        definition: { ...s.definition, root: nextRoot },
        selectedActivityId: s.selectedActivityId === id ? null : s.selectedActivityId,
        isDirty: true,
      };
    }),

  duplicateActivityById: (id) =>
    set((s) => {
      if (!s.definition) return s;
      const snap: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const nextRoot = duplicateActivityInRoot(s.definition.root, id);
      if (nextRoot === s.definition.root) return s;
      return {
        past: [...s.past, snap].slice(-MAX_HISTORY),
        future: [],
        definition: { ...s.definition, root: nextRoot },
        isDirty: true,
      };
    }),

  moveSequenceActivity: (id, direction) =>
    set((s) => {
      if (!s.definition) return s;
      const container = getContainerAt(s.definition.root, s.containerStack);
      if (!isSequenceRoot(container)) return s;
      const activities = container.activities ?? [];
      const idx = activities.findIndex((a) => a.id === id);
      if (idx < 0) return s;
      const targetIdx = direction === "earlier" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= activities.length) return s;
      const next = activities.slice();
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      const updatedContainer = layoutRootSequence({ ...container, activities: next });
      const snap: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        updatedContainer,
      );
      return {
        past: [...s.past, snap].slice(-MAX_HISTORY),
        future: [],
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
      };
    }),

  toggleCanStartWorkflow: (id) =>
    set((s) => {
      if (!s.definition) return s;
      const snap: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const nextRoot = toggleCanStartInRoot(s.definition.root, id);
      if (nextRoot === s.definition.root) return s;
      return {
        past: [...s.past, snap].slice(-MAX_HISTORY),
        future: [],
        definition: { ...s.definition, root: nextRoot },
        isDirty: true,
      };
    }),

  enterContainer: (id, displayName) =>
    set((s) => ({
      containerStack: [...s.containerStack, { id, displayName }],
      selectedActivityId: null,
    })),

  enterContainerByPort: (activityId, portName, displayName) =>
    set((s) => ({
      containerStack: [
        ...s.containerStack,
        { id: activityId, portName, displayName },
      ],
      selectedActivityId: null,
    })),

  popContainer: () =>
    set((s) =>
      s.containerStack.length === 0
        ? s
        : {
            containerStack: s.containerStack.slice(0, -1),
            selectedActivityId: null,
          },
    ),

  popToContainer: (index) =>
    set((s) =>
      index < 0
        ? { containerStack: [], selectedActivityId: null }
        : {
            containerStack: s.containerStack.slice(0, index + 1),
            selectedActivityId: null,
          },
    ),

  setValidationErrors: (errors) => set({ validationErrors: errors }),
  clearValidationErrors: () => set({ validationErrors: null }),

  addStateMachineState: (positionHint) =>
    set((s) => {
      if (!s.definition) return s;
      const root = s.definition.root;
      if (!isStateMachineActivity(root)) return s;
      const states = (root.states as StateMachineState[] | undefined) ?? [];
      const taken = new Set(states.map((st) => st.name));
      let i = states.length + 1;
      let name = `State${i}`;
      while (taken.has(name)) {
        i += 1;
        name = `State${i}`;
      }
      const newState: StateMachineState = {
        name,
        metadata: positionHint
          ? { designer: { position: { x: Math.round(positionHint.x), y: Math.round(positionHint.y) } } }
          : undefined,
      };
      const nextStates = [...states, newState];
      const nextRoot: ActivityJson = {
        ...root,
        states: nextStates,
        // Promote the first state to initial if the machine was empty.
        ...(states.length === 0 ? { initialState: name } : {}),
      };
      // Snapshot for undo, then write through containerStack so SM nodes nested
      // inside a Flowchart (rare today, but possible later) keep working.
      const snapshot: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snapshot].slice(-MAX_HISTORY);
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        nextRoot,
      );
      return {
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
        past,
        future: [],
        selectedActivityId: name,
        selectedTransitionIndex: null,
      };
    }),

  addStateMachineTransition: (from, to) =>
    set((s) => {
      if (!s.definition) return s;
      const root = s.definition.root;
      if (!isStateMachineActivity(root)) return s;
      const states = (root.states as StateMachineState[] | undefined) ?? [];
      if (!states.find((st) => st.name === from)) return s;
      if (!states.find((st) => st.name === to)) return s;
      const transitions =
        (root.transitions as StateMachineTransition[] | undefined) ?? [];
      const nextTransitions: StateMachineTransition[] = [
        ...transitions,
        { from, to },
      ];
      const nextRoot: ActivityJson = { ...root, transitions: nextTransitions };
      const snapshot: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snapshot].slice(-MAX_HISTORY);
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        nextRoot,
      );
      return {
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
        past,
        future: [],
        selectedActivityId: null,
        selectedTransitionIndex: nextTransitions.length - 1,
      };
    }),

  removeStateMachineState: (name) =>
    set((s) => {
      if (!s.definition) return s;
      const root = s.definition.root;
      if (!isStateMachineActivity(root)) return s;
      const states = (root.states as StateMachineState[] | undefined) ?? [];
      if (!states.some((st) => st.name === name)) return s;
      const transitions =
        (root.transitions as StateMachineTransition[] | undefined) ?? [];
      const nextStates = states.filter((st) => st.name !== name);
      const nextTransitions = transitions.filter(
        (t) => t.from !== name && t.to !== name,
      );
      const nextRoot: ActivityJson = {
        ...root,
        states: nextStates,
        transitions: nextTransitions,
        // Clear initial/current when they point at the removed state. If the
        // removed state was initial, promote the first survivor instead so
        // the machine doesn't end up unrunnable for a one-key change.
        ...(root.initialState === name
          ? { initialState: nextStates[0]?.name ?? null }
          : {}),
        ...(root.currentState === name ? { currentState: null } : {}),
      };
      const snapshot: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snapshot].slice(-MAX_HISTORY);
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        nextRoot,
      );
      return {
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
        past,
        future: [],
        selectedActivityId: s.selectedActivityId === name ? null : s.selectedActivityId,
        selectedTransitionIndex: null,
      };
    }),

  renameStateMachineState: (oldName, newName) =>
    set((s) => {
      const trimmed = newName.trim();
      if (!trimmed || oldName === trimmed) return s;
      if (!s.definition) return s;
      const root = s.definition.root;
      if (!isStateMachineActivity(root)) return s;
      const states = (root.states as StateMachineState[] | undefined) ?? [];
      if (!states.some((st) => st.name === oldName)) return s;
      // Reject when the new name collides with another existing state.
      if (states.some((st) => st.name === trimmed)) return s;
      const transitions =
        (root.transitions as StateMachineTransition[] | undefined) ?? [];
      const nextStates = states.map((st) =>
        st.name === oldName ? { ...st, name: trimmed } : st,
      );
      const nextTransitions = transitions.map((t) => ({
        ...t,
        from: t.from === oldName ? trimmed : t.from,
        to: t.to === oldName ? trimmed : t.to,
      }));
      const nextRoot: ActivityJson = {
        ...root,
        states: nextStates,
        transitions: nextTransitions,
        ...(root.initialState === oldName ? { initialState: trimmed } : {}),
        ...(root.currentState === oldName ? { currentState: trimmed } : {}),
      };
      const snapshot: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snapshot].slice(-MAX_HISTORY);
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        nextRoot,
      );
      return {
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
        past,
        future: [],
        selectedActivityId:
          s.selectedActivityId === oldName ? trimmed : s.selectedActivityId,
      };
    }),

  setStateMachineInitialState: (name) =>
    set((s) => {
      if (!s.definition) return s;
      const root = s.definition.root;
      if (!isStateMachineActivity(root)) return s;
      const states = (root.states as StateMachineState[] | undefined) ?? [];
      if (!states.some((st) => st.name === name)) return s;
      if (root.initialState === name) return s;
      const nextRoot: ActivityJson = { ...root, initialState: name };
      const snapshot: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snapshot].slice(-MAX_HISTORY);
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        nextRoot,
      );
      return {
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
        past,
        future: [],
      };
    }),

  removeStateMachineTransitionByIndex: (index) =>
    set((s) => {
      if (!s.definition) return s;
      const root = s.definition.root;
      if (!isStateMachineActivity(root)) return s;
      const transitions =
        (root.transitions as StateMachineTransition[] | undefined) ?? [];
      if (index < 0 || index >= transitions.length) return s;
      const nextTransitions = transitions.filter((_, i) => i !== index);
      const nextRoot: ActivityJson = { ...root, transitions: nextTransitions };
      const snapshot: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snapshot].slice(-MAX_HISTORY);
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        nextRoot,
      );
      return {
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
        past,
        future: [],
        selectedTransitionIndex:
          s.selectedTransitionIndex === index ? null : s.selectedTransitionIndex,
      };
    }),

  updateStateMachineTransition: (index, patch) =>
    set((s) => {
      if (!s.definition) return s;
      const root = s.definition.root;
      if (!isStateMachineActivity(root)) return s;
      const transitions =
        (root.transitions as StateMachineTransition[] | undefined) ?? [];
      if (index < 0 || index >= transitions.length) return s;
      const states = (root.states as StateMachineState[] | undefined) ?? [];
      // Validate from/to against existing states; reject the patch when an
      // endpoint refers to a non-existent state.
      if (patch.from !== undefined && !states.some((st) => st.name === patch.from)) {
        return s;
      }
      if (patch.to !== undefined && !states.some((st) => st.name === patch.to)) {
        return s;
      }
      const nextTransitions = transitions.map((t, i) =>
        i === index
          ? {
              ...t,
              ...(patch.name !== undefined ? { name: patch.name } : {}),
              ...(patch.displayName !== undefined
                ? { displayName: patch.displayName }
                : {}),
              ...(patch.from !== undefined ? { from: patch.from } : {}),
              ...(patch.to !== undefined ? { to: patch.to } : {}),
              ...(patch.condition !== undefined
                ? { condition: patch.condition }
                : {}),
            }
          : t,
      );
      const nextRoot: ActivityJson = { ...root, transitions: nextTransitions };
      const snapshot: Snapshot = {
        root: s.definition.root,
        selectedActivityId: s.selectedActivityId,
      };
      const past = [...s.past, snapshot].slice(-MAX_HISTORY);
      const nextWorkflowRoot = updateContainerAt(
        s.definition.root,
        s.containerStack,
        nextRoot,
      );
      return {
        definition: { ...s.definition, root: nextWorkflowRoot },
        isDirty: true,
        past,
        future: [],
      };
    }),
}));

// ---------------------------------------------------------------------------
// Pure helpers for activity-tree mutations. Currently only Flowchart roots
// (activities[] + connections[]) are supported; non-Flowchart roots fall
// through unchanged. Phase 3 will expand this once embedded ports land.
// ---------------------------------------------------------------------------

function removeActivityFromRoot(root: ActivityJson, id: string): ActivityJson {
  if (!Array.isArray(root.activities)) return root;
  const activities = root.activities.filter((a) => a.id !== id);
  if (activities.length === root.activities.length) return root;

  // Delete-with-bridge: when the removed activity has exactly one predecessor
  // edge and exactly one successor edge, replace those two edges with a
  // single edge that bridges them. Keeps the linear "A → B → C" flow alive
  // when the user removes the middle step. Mirrors Blazor's
  // `removeNodesWithBridge` behaviour. Only applies to Flowchart roots
  // (Sequence has no `connections` array; State Machine doesn't take this
  // code path since `removeActivityFromRoot` is gated on `root.activities`).
  let connections = root.connections;
  if (Array.isArray(root.connections)) {
    const predecessors = root.connections.filter(
      (c) => c.target.activity === id,
    );
    const successors = root.connections.filter(
      (c) => c.source.activity === id,
    );
    const withoutDeleted = root.connections.filter(
      (c) => c.source.activity !== id && c.target.activity !== id,
    );
    if (predecessors.length === 1 && successors.length === 1) {
      const pred = predecessors[0];
      const succ = successors[0];
      // Preserve the source port (outcome) from the surviving predecessor and
      // the target port from the successor. The user keeps whichever outcome
      // led into the deleted node — semantically the closest match.
      connections = [
        ...withoutDeleted,
        {
          source: { activity: pred.source.activity, port: pred.source.port },
          target: { activity: succ.target.activity, port: succ.target.port },
        },
      ];
    } else {
      connections = withoutDeleted;
    }
  }

  const start =
    typeof root.start === "object" &&
    root.start &&
    "activity" in root.start &&
    root.start.activity === id
      ? null
      : typeof root.start === "string" && root.start === id
        ? null
        : root.start;
  return { ...root, activities, connections, start };
}

function duplicateActivityInRoot(root: ActivityJson, id: string): ActivityJson {
  if (!Array.isArray(root.activities)) return root;
  const src = root.activities.find((a) => a.id === id);
  if (!src) return root;
  const cloned = deepCloneWithFreshIds(src);
  const oldPos = src.metadata?.designer?.position;
  const newPos =
    oldPos && typeof oldPos.x === "number" && typeof oldPos.y === "number"
      ? { x: oldPos.x + 24, y: oldPos.y + 24 }
      : { x: 24, y: 24 };
  cloned.metadata = {
    ...(cloned.metadata ?? {}),
    designer: {
      ...((cloned.metadata?.designer as Record<string, unknown> | undefined) ?? {}),
      position: newPos,
    },
  };
  return { ...root, activities: [...root.activities, cloned] };
}

function toggleCanStartInRoot(root: ActivityJson, id: string): ActivityJson {
  if (!Array.isArray(root.activities)) return root;
  let changed = false;
  const activities = root.activities.map((a) => {
    if (a.id !== id) return a;
    changed = true;
    const current = (a as Record<string, unknown>).canStartWorkflow === true;
    return { ...a, canStartWorkflow: !current };
  });
  if (!changed) return root;
  return { ...root, activities };
}

function deepCloneWithFreshIds(src: ActivityJson): ActivityJson {
  const clone: ActivityJson = JSON.parse(JSON.stringify(src));
  reassignIds(clone);
  return clone;
}

function reassignIds(node: ActivityJson): void {
  const type = node.type ?? "Activity";
  const segs = type.split(".");
  const short = segs[segs.length - 1] ?? type;
  node.id = `${short.charAt(0).toLowerCase()}${short.slice(1)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  if (Array.isArray(node.activities)) {
    for (const child of node.activities) reassignIds(child);
  }
}

/**
 * Walk the activity tree and find an activity by id. Walks both `activities[]`
 * and any embedded-port fields (single child or arrays of children) so the
 * properties panel can resolve activities nested inside If/ForEach/Switch/etc.
 */
export function findActivityById(
  node: ActivityJson | undefined | null,
  id: string,
): ActivityJson | null {
  if (!node) return null;
  if (node.id === id) return node;
  for (const [key, value] of Object.entries(node)) {
    // Skip designer metadata and other non-tree fields cheaply.
    if (key === "metadata") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (looksLikeActivity(item)) {
          const hit = findActivityById(item, id);
          if (hit) return hit;
        }
      }
    } else if (looksLikeActivity(value)) {
      const hit = findActivityById(value, id);
      if (hit) return hit;
    }
  }
  return null;
}

function looksLikeActivity(x: unknown): x is ActivityJson {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { type?: unknown }).type === "string"
  );
}

// ---------------------------------------------------------------------------
// Container drilling helpers. Two flavours of frame are supported:
//
//   - Direct-activity frame (no `portName`): the canvas is drilled into a
//     Flowchart-typed activity placed in its parent's `activities[]`.
//   - Port-attached frame (`portName` set): the canvas is drilled into the
//     child activity attached to a named embedded port on the parent
//     (e.g. `If.Then`). Reads/writes route through the embedded-port
//     providers so per-type wrappers (Switch's `{ label, condition, activity }`
//     cases) stay intact.
// ---------------------------------------------------------------------------

/**
 * Resolve the active container by walking `frames` from `workflowRoot`. Each
 * frame names an activity (by id) sitting in the current container's
 * `activities[]`. Direct-child frames replace `current` with that activity
 * (Flowchart-in-Flowchart). Port frames take one more step: they replace
 * `current` with the child attached at `frame.portName` on that activity
 * (`if.then`, `httpRequest.unmatchedStatusCode`, etc.). If anything fails to
 * resolve, the walk stops and returns the deepest container found so far.
 */
export function getContainerAt(
  workflowRoot: ActivityJson,
  frames: ContainerFrame[],
): ActivityJson {
  let current = workflowRoot;
  for (const f of frames) {
    let parent: ActivityJson | undefined;
    // The frame can refer to `current` itself (e.g. a State Machine root with
    // a port frame `state:<name>:entry`) — in that case there's no
    // `activities[]` to walk through; the SM root IS the parent slot owner.
    if (current.id === f.id) {
      parent = current;
    } else if (Array.isArray(current.activities)) {
      parent = current.activities.find((a) => a.id === f.id);
    }
    if (!parent) return current;
    if (f.portName) {
      const child = getEmbeddedChildrenByName(parent, f.portName)[0];
      if (!child) return current;
      current = child;
    } else {
      current = parent;
    }
  }
  return current;
}

/**
 * Replace the activity at the deepest frame with `updatedContainer`, rebuilding
 * the spine of containers so React sees a brand-new workflow root. Port frames
 * round-trip through `setEmbeddedChildren` so per-type write semantics (e.g.
 * Switch's wrapped cases) survive the rebuild.
 */
export function updateContainerAt(
  workflowRoot: ActivityJson,
  frames: ContainerFrame[],
  updatedContainer: ActivityJson,
): ActivityJson {
  if (frames.length === 0) return updatedContainer;
  const [head, ...rest] = frames;
  // Frame may refer to the workflow root itself (State Machine slots).
  if (workflowRoot.id === head.id) {
    if (head.portName) {
      const child = getEmbeddedChildrenByName(workflowRoot, head.portName)[0];
      const newChild = child
        ? updateContainerAt(child, rest, updatedContainer)
        : updatedContainer;
      return setEmbeddedChildrenByName(workflowRoot, head.portName, [newChild]);
    }
    return updateContainerAt(workflowRoot, rest, updatedContainer);
  }
  const activities = workflowRoot.activities ?? [];
  return {
    ...workflowRoot,
    activities: activities.map((a) => {
      if (a.id !== head.id) return a;
      if (head.portName) {
        const child = getEmbeddedChildrenByName(a, head.portName)[0];
        if (!child) return a;
        const newChild = updateContainerAt(child, rest, updatedContainer);
        return setEmbeddedChildrenByName(a, head.portName, [newChild]);
      }
      return updateContainerAt(a, rest, updatedContainer);
    }),
  };
}

/** Detect whether the activity can be drilled into as a Flowchart sub-graph. */
export function isFlowchartContainer(activity: ActivityJson | null | undefined): boolean {
  if (!activity || typeof activity.type !== "string") return false;
  return activity.type.endsWith(".Flowchart") || activity.type === "Flowchart";
}

/**
 * Type guard mirror of `isStateMachineRoot` from build-graph, kept local to
 * avoid a cyclic import. Used by the SM-specific store actions.
 */
function isStateMachineActivity(activity: ActivityJson | null | undefined): boolean {
  if (!activity || typeof activity.type !== "string") return false;
  return activity.type === "Elsa.StateMachine" || activity.type.endsWith(".StateMachine");
}

/**
 * Thin shim over `embedded-ports.ts` that takes a port *name* rather than a
 * full `PortDescriptor`. Frames only carry the name, so the walk needs to
 * synthesize a minimal descriptor when calling into the providers.
 */
function getEmbeddedChildrenByName(parent: ActivityJson, portName: string): ActivityJson[] {
  return getEmbeddedChildren(parent, { name: portName });
}

function setEmbeddedChildrenByName(
  parent: ActivityJson,
  portName: string,
  children: ActivityJson[],
): ActivityJson {
  return setEmbeddedChildren(parent, { name: portName }, children);
}
