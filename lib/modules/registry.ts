import { alterationsModule } from "@/features/alterations/module";
import { dashboardModule } from "@/features/dashboard/module";
import { diagnosticsModule } from "@/features/diagnostics/module";
import { labelsModule } from "@/features/labels/module";
import { securityModule } from "@/features/security/module";
import { settingsModule } from "@/features/settings/module";
import { workflowsModule } from "@/features/workflows/module";

import { MODULE_ROUTE_MANIFEST } from "./route-manifest";
import type { StudioModule } from "./types";

/**
 * The full set of modules known to the studio. Order in this array drives
 * the order of nav groups and items in the sidebar. Adding a module means
 * (a) creating `features/<id>/module.ts`, (b) adding it here, and (c) adding
 * the matching entry to `lib/modules/route-manifest.ts` so middleware can
 * gate the route in the edge runtime.
 */
export const ALL_MODULES: readonly StudioModule[] = [
  dashboardModule,
  workflowsModule,
  alterationsModule,
  diagnosticsModule,
  securityModule,
  labelsModule,
  settingsModule,
];

// Dev-only: catch route-manifest drift early. If a developer adds a module
// here but forgets to update `route-manifest.ts`, middleware would silently
// allow the route through — this surfaces it on first import.
if (process.env.NODE_ENV !== "production") {
  const manifestIds = new Set(MODULE_ROUTE_MANIFEST.map((m) => m.id));
  const registryIds = new Set(ALL_MODULES.map((m) => m.id));
  const missingFromManifest = [...registryIds].filter((id) => !manifestIds.has(id));
  const missingFromRegistry = [...manifestIds].filter((id) => !registryIds.has(id));
  if (missingFromManifest.length > 0 || missingFromRegistry.length > 0) {
    const lines = [
      "Module registry and route manifest are out of sync.",
      missingFromManifest.length > 0
        ? `  In registry but not route-manifest: ${missingFromManifest.join(", ")}`
        : "",
      missingFromRegistry.length > 0
        ? `  In route-manifest but not registry: ${missingFromRegistry.join(", ")}`
        : "",
      "  Update lib/modules/route-manifest.ts to match lib/modules/registry.ts.",
    ].filter(Boolean);
    throw new Error(lines.join("\n"));
  }
}

export function getModuleById(id: string): StudioModule | undefined {
  return ALL_MODULES.find((m) => m.id === id);
}
