/**
 * Shared formatters for type names returned by the Elsa server.
 *
 * The server's `displayName` is usually already friendly — e.g. "String",
 * "Int32", "WorkflowInstance" — but some descriptors fall back to the
 * .NET type name (or even the assembly-qualified name). This module is
 * the single source of truth used by the variable dialog, variables tab,
 * and inputs/outputs dialogs so labels read consistently.
 */

/** Drop assembly suffix, namespace, and generic-arity backtick. */
export function shortenTypeName(name: string): string {
  const noAssembly = name.split(",")[0].trim();
  const noNamespace = noAssembly.split(".").pop() ?? noAssembly;
  return noNamespace.split("`")[0];
}

/**
 * Returns the most user-readable label for a type. If the descriptor's
 * `displayName` is already friendly (no namespace dots, no assembly
 * commas) we use it as-is; otherwise we shorten whichever field looks
 * least ugly.
 */
export function friendlyTypeLabel(displayName: string | undefined, typeName: string): string {
  if (displayName && !displayName.includes(",") && !displayName.includes(".")) {
    return displayName;
  }
  return shortenTypeName(displayName || typeName);
}
