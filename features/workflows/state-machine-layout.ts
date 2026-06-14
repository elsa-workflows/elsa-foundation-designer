import type { ActivityJson, StateMachineState } from "@/lib/api/types";

const STATE_W = 200;
const STATE_H = 84;
const COL_GAP = 64;
const ROW_GAP = 56;

/**
 * Hand-rolled grid layout for state machines. Used when no designer positions
 * are persisted in the JSON. Cols = ceil(sqrt(N)) so a 4-state machine packs
 * into a 2×2, a 9-state machine into a 3×3, etc.
 *
 * Returns a map of state-name → position.
 */
export function layoutStateMachineGrid(
  stateNames: string[],
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const n = stateNames.length;
  if (n === 0) return out;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  stateNames.forEach((name, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    out.set(name, {
      x: col * (STATE_W + COL_GAP),
      y: row * (STATE_H + ROW_GAP),
    });
  });
  return out;
}

/**
 * Auto-layout a State Machine root by writing fresh `metadata.designer.position`
 * into each state. Used by the toolbar's "Auto-layout" button.
 *
 * Non-StateMachine roots are returned unchanged.
 */
export function layoutRootStateMachine(root: ActivityJson): ActivityJson {
  const states = root.states as StateMachineState[] | undefined;
  if (!Array.isArray(states)) return root;
  const positions = layoutStateMachineGrid(states.map((s) => s.name));
  const nextStates: StateMachineState[] = states.map((s) => {
    const p = positions.get(s.name);
    if (!p) return s;
    return {
      ...s,
      metadata: {
        ...(s.metadata ?? {}),
        designer: {
          ...(s.metadata?.designer ?? {}),
          position: p,
        },
      },
    };
  });
  return { ...root, states: nextStates };
}
