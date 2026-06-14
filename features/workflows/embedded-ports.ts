import type { ActivityJson, Port } from "@/lib/api/types";

/**
 * Resolves embedded-port children for container activities (If/ForEach/While/
 * Sequence/Parallel/...). Mirrors the Blazor `IActivityPortService` +
 * `IActivityPortProvider` abstraction so we can render container activities
 * with inline dashed slots like the V2 designer does.
 *
 * For each (activity type, port name) pair, a provider returns 0 or more
 * direct child activities. Single-child ports (If.Then, ForEach.Body) return
 * a 1-element array; collection ports (Sequence.Activities) return all
 * children in order. The default provider just reads `activity[camelize(port)]`
 * and unwraps an array if found.
 */

export type PortProvider = {
  /** Return the embedded children of `activity` for the named port. */
  getChildren: (activity: ActivityJson, portName: string) => ActivityJson[];
  /** Write `children` back into `activity` for the named port; returns the new activity. */
  setChildren: (
    activity: ActivityJson,
    portName: string,
    children: ActivityJson[],
  ) => ActivityJson;
};

/** Strip the `Elsa.` prefix and any further namespace so we can register by short name. */
function shortType(typeName: string): string {
  const segs = typeName.split(".");
  return segs[segs.length - 1] ?? typeName;
}

function camelize(name: string): string {
  if (!name) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

const defaultProvider: PortProvider = {
  getChildren(activity, portName) {
    const key = camelize(portName);
    const raw = (activity as Record<string, unknown>)[key];
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.filter(isActivity);
    }
    if (isActivity(raw)) return [raw];
    return [];
  },
  setChildren(activity, portName, children) {
    const key = camelize(portName);
    const next = { ...activity } as Record<string, unknown>;
    next[key] = children.length === 0 ? null : children[0];
    return next as ActivityJson;
  },
};

const arrayProvider: PortProvider = {
  getChildren(activity, portName) {
    const key = camelize(portName);
    const raw = (activity as Record<string, unknown>)[key];
    if (Array.isArray(raw)) return raw.filter(isActivity);
    return [];
  },
  setChildren(activity, portName, children) {
    const key = camelize(portName);
    const next = { ...activity } as Record<string, unknown>;
    next[key] = children;
    return next as ActivityJson;
  },
};

/**
 * `Elsa.Switch` stores its branches as wrapped case objects:
 *   `{ cases: [{ label, condition, activity }, ...], default: <activity> }`
 *
 * We expose the `Default` port as a normal single-child port and surface each
 * wrapped case under its label so the canvas can show all branches in order.
 * Writes preserve the case wrapper (label + condition) by index — adding a
 * new child appends a fresh `{ label, condition: null, activity }` wrapper.
 */
const switchProvider: PortProvider = {
  getChildren(activity, portName) {
    const p = portName.toLowerCase();
    if (p === "default") {
      const def = (activity as Record<string, unknown>).default;
      return isActivity(def) ? [def] : [];
    }
    const cases = (activity as Record<string, unknown>).cases;
    if (!Array.isArray(cases)) return [];
    // Match the specific case by label first; fall back to "all cases" when
    // the descriptor declares a single aggregated port (Cases).
    const match = cases.find(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).label === "string" &&
        ((c as Record<string, unknown>).label as string).toLowerCase() === p,
    );
    if (match && typeof match === "object") {
      const child = (match as Record<string, unknown>).activity;
      return isActivity(child) ? [child] : [];
    }
    if (p === "cases") {
      return cases
        .map((c) =>
          typeof c === "object" && c !== null
            ? (c as Record<string, unknown>).activity
            : null,
        )
        .filter(isActivity);
    }
    return [];
  },
  setChildren(activity, portName, children) {
    const p = portName.toLowerCase();
    if (p === "default") {
      const next = { ...activity } as Record<string, unknown>;
      next.default = children.length === 0 ? null : children[0];
      return next as ActivityJson;
    }
    const next = { ...activity } as Record<string, unknown>;
    const prevCases = Array.isArray(next.cases) ? [...(next.cases as unknown[])] : [];
    const targetIndex = prevCases.findIndex(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as Record<string, unknown>).label === "string" &&
        ((c as Record<string, unknown>).label as string).toLowerCase() === p,
    );
    if (targetIndex >= 0) {
      const existing = prevCases[targetIndex] as Record<string, unknown>;
      prevCases[targetIndex] = {
        ...existing,
        activity: children.length === 0 ? null : children[0],
      };
    } else if (children.length > 0) {
      prevCases.push({
        label: portName,
        condition: null,
        activity: children[0],
      });
    }
    next.cases = prevCases;
    return next as ActivityJson;
  },
};

/**
 * `Elsa.StateMachine` carries activity slots inside nested objects:
 *   `{ states: [{ name, entry, exit, … }], transitions: [{ from, to, trigger, action, … }] }`
 *
 * To let the editor's `containerStack` machinery drill into one of those slots
 * we encode the path as a port name and parse it back here. Conventions used
 * by the state-machine UI to enter a slot:
 *   - `state:<name>:entry`
 *   - `state:<name>:exit`
 *   - `transition:<index>:trigger`
 *   - `transition:<index>:action`
 */
const stateMachineProvider: PortProvider = {
  getChildren(activity, portName) {
    const slot = parseStateMachineSlot(portName);
    if (!slot) return [];
    const node = readStateMachineSlot(activity, slot);
    return isActivity(node) ? [node] : [];
  },
  setChildren(activity, portName, children) {
    const slot = parseStateMachineSlot(portName);
    if (!slot) return activity;
    const next = children.length === 0 ? null : children[0];
    return writeStateMachineSlot(activity, slot, next);
  },
};

type SmSlot =
  | { kind: "state"; name: string; field: "entry" | "exit" }
  | { kind: "transition"; index: number; field: "trigger" | "action" };

function parseStateMachineSlot(portName: string): SmSlot | null {
  const stateMatch = /^state:(.+):(entry|exit)$/.exec(portName);
  if (stateMatch) {
    return {
      kind: "state",
      name: stateMatch[1],
      field: stateMatch[2] as "entry" | "exit",
    };
  }
  const transMatch = /^transition:(\d+):(trigger|action)$/.exec(portName);
  if (transMatch) {
    return {
      kind: "transition",
      index: Number.parseInt(transMatch[1], 10),
      field: transMatch[2] as "trigger" | "action",
    };
  }
  return null;
}

function readStateMachineSlot(activity: ActivityJson, slot: SmSlot): unknown {
  if (slot.kind === "state") {
    const states = (activity as Record<string, unknown>).states;
    if (!Array.isArray(states)) return null;
    const state = states.find(
      (s) => typeof s === "object" && s !== null && (s as Record<string, unknown>).name === slot.name,
    );
    if (!state || typeof state !== "object") return null;
    return (state as Record<string, unknown>)[slot.field];
  }
  const transitions = (activity as Record<string, unknown>).transitions;
  if (!Array.isArray(transitions)) return null;
  const t = transitions[slot.index];
  if (!t || typeof t !== "object") return null;
  return (t as Record<string, unknown>)[slot.field];
}

function writeStateMachineSlot(
  activity: ActivityJson,
  slot: SmSlot,
  value: ActivityJson | null,
): ActivityJson {
  const next = { ...activity } as Record<string, unknown>;
  if (slot.kind === "state") {
    const states = Array.isArray(next.states) ? [...(next.states as unknown[])] : [];
    const idx = states.findIndex(
      (s) => typeof s === "object" && s !== null && (s as Record<string, unknown>).name === slot.name,
    );
    if (idx < 0) return activity;
    const target = states[idx] as Record<string, unknown>;
    states[idx] = { ...target, [slot.field]: value };
    next.states = states;
  } else {
    const transitions = Array.isArray(next.transitions)
      ? [...(next.transitions as unknown[])]
      : [];
    if (slot.index < 0 || slot.index >= transitions.length) return activity;
    const target = transitions[slot.index] as Record<string, unknown>;
    transitions[slot.index] = { ...target, [slot.field]: value };
    next.transitions = transitions;
  }
  return next as ActivityJson;
}

/**
 * Type-name → provider. Short type names so registrations don't depend on
 * full namespace (`Elsa.Sequence` and a third-party `Acme.Sequence` would
 * share the same provider).
 */
const REGISTRY: Record<string, PortProvider> = {
  Sequence: arrayProvider, // activities[]
  Parallel: arrayProvider, // branches[]
  Flowchart: arrayProvider, // activities[] (only relevant when nested)
  Switch: switchProvider, // cases[].activity + default
  StateMachine: stateMachineProvider, // state:<name>:entry|exit + transition:<i>:trigger|action
};

export function getProvider(activity: ActivityJson): PortProvider {
  const key = shortType(activity.type);
  return REGISTRY[key] ?? defaultProvider;
}

/** Convenience accessor used by the activity card renderer. */
export function getEmbeddedChildren(
  activity: ActivityJson,
  port: Pick<Port, "name">,
): ActivityJson[] {
  return getProvider(activity).getChildren(activity, port.name);
}

/** Write `children` back to the named port on `activity`. */
export function setEmbeddedChildren(
  activity: ActivityJson,
  port: Pick<Port, "name">,
  children: ActivityJson[],
): ActivityJson {
  return getProvider(activity).setChildren(activity, port.name, children);
}

/** Register or override a port provider for an activity type. */
export function registerPortProvider(typeShort: string, provider: PortProvider): void {
  REGISTRY[typeShort] = provider;
}

function isActivity(x: unknown): x is ActivityJson {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { id?: unknown }).id === "string" &&
    typeof (x as { type?: unknown }).type === "string"
  );
}
