/**
 * Edge-runtime-safe subset of the module registry. Imported by `middleware.ts`
 * to decide whether a request to a disabled module's URL should be redirected
 * to /dashboard.
 *
 * MUST stay icon-free and React-free — middleware runs on the edge runtime
 * which cannot load `lucide-react` or any component code. The full module
 * manifests live next to each feature in `features/<id>/module.ts`.
 *
 * Keep this list in lock-step with `lib/modules/registry.ts`. The dev-only
 * sanity check at the bottom of `registry.ts` throws loud if the two drift.
 */

export type ModuleRouteEntry = {
  id: string;
  ownedPaths: string[];
  required: boolean;
  defaultEnabled: boolean;
};

export const MODULES_COOKIE = "elsa_modules";

export const MODULE_ROUTE_MANIFEST: readonly ModuleRouteEntry[] = [
  { id: "dashboard", ownedPaths: ["/dashboard"], required: true, defaultEnabled: true },
  { id: "workflows", ownedPaths: ["/workflows"], required: true, defaultEnabled: true },
  { id: "alterations", ownedPaths: ["/alterations"], required: false, defaultEnabled: true },
  { id: "diagnostics", ownedPaths: ["/diagnostics"], required: false, defaultEnabled: true },
  { id: "security", ownedPaths: ["/security"], required: false, defaultEnabled: true },
  { id: "labels", ownedPaths: ["/labels"], required: false, defaultEnabled: true },
  { id: "settings", ownedPaths: ["/settings"], required: true, defaultEnabled: true },
];

export function isPathOwnedByModule(
  pathname: string,
  entry: ModuleRouteEntry,
): boolean {
  return entry.ownedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export function parseEnabledCookie(
  raw: string | undefined,
): string[] {
  const required = MODULE_ROUTE_MANIFEST.filter((m) => m.required).map((m) => m.id);
  const known = new Set(MODULE_ROUTE_MANIFEST.map((m) => m.id));
  if (!raw) {
    return MODULE_ROUTE_MANIFEST
      .filter((m) => m.required || m.defaultEnabled)
      .map((m) => m.id);
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    const userIds = parsed.filter(
      (id): id is string => typeof id === "string" && known.has(id),
    );
    return Array.from(new Set([...userIds, ...required]));
  } catch {
    return MODULE_ROUTE_MANIFEST
      .filter((m) => m.required || m.defaultEnabled)
      .map((m) => m.id);
  }
}
