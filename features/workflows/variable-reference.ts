/**
 * Wire-shape helpers for the Variable / Input expression syntaxes.
 *
 * Elsa stores these bindings as a JSON-stringified payload inside the
 * `expression.value` cell. The server-side handlers deserialize them back
 * into runtime types:
 *
 *   Variable: full `Variable` JSON (id, name, typeName, value, storageDriverTypeName)
 *             — the .NET `VariableExpressionHandler` does
 *             `expression.Value as Variable`, so the JSON must round-trip
 *             back into a `Variable` instance. Mirrors what Blazor's
 *             `VariablePicker.razor.cs` writes.
 *   Input:    { name, displayName?, type? } — the input handler matches by name.
 *
 * The cell is `string` on the wire; parsing is defensive — older payloads
 * may have stored just the id (or just the name), and we tolerate that.
 */
import type { VariableDefinition } from "@/lib/api/types";

export type VariableRef = { id: string; name?: string };
export type InputRef = { name: string; displayName?: string; type?: string };

export function readVariableRef(value: unknown): VariableRef | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // Try JSON; fall back to "value is just the id".
    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed) as Partial<VariableRef>;
        if (obj && typeof obj.id === "string") {
          return { id: obj.id, name: typeof obj.name === "string" ? obj.name : undefined };
        }
      } catch {
        // fall through
      }
    }
    return { id: trimmed };
  }
  if (typeof value === "object") {
    const obj = value as Partial<VariableRef>;
    if (typeof obj.id === "string") {
      return { id: obj.id, name: typeof obj.name === "string" ? obj.name : undefined };
    }
  }
  return null;
}

/**
 * Serialize a `VariableDefinition` for storage on an activity's input
 * `expression.value`. Includes every field the .NET `Variable` record needs
 * (id, name, typeName, value, isArray, storageDriverTypeName) so the runtime
 * handler can rehydrate the variable instance — matches Blazor's
 * `JsonSerializer.Serialize(variable, …)`.
 */
export function writeVariableRef(variable: VariableDefinition): string {
  return JSON.stringify({
    id: variable.id,
    name: variable.name,
    typeName: variable.typeName,
    isArray: variable.isArray ?? false,
    value: variable.value ?? null,
    storageDriverTypeName: variable.storageDriverTypeName ?? null,
  });
}

export function readInputRef(value: unknown): InputRef | null {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed) as Partial<InputRef>;
        if (obj && typeof obj.name === "string") {
          return {
            name: obj.name,
            displayName: typeof obj.displayName === "string" ? obj.displayName : undefined,
            type: typeof obj.type === "string" ? obj.type : undefined,
          };
        }
      } catch {
        // fall through
      }
    }
    return { name: trimmed };
  }
  if (typeof value === "object") {
    const obj = value as Partial<InputRef>;
    if (typeof obj.name === "string") {
      return {
        name: obj.name,
        displayName: typeof obj.displayName === "string" ? obj.displayName : undefined,
        type: typeof obj.type === "string" ? obj.type : undefined,
      };
    }
  }
  return null;
}

export function writeInputRef(ref: InputRef): string {
  return JSON.stringify({
    name: ref.name,
    displayName: ref.displayName ?? null,
    type: ref.type ?? null,
  });
}
