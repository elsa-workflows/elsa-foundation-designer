import type { ComponentType } from "react";

export type NavTint = {
  bg: string;
  fg: string;
  glow: string;
};

export type ModuleNavLeaf = {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  placeholder?: boolean;
};

export type ModuleNavParent = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  basePath: string;
  items: ModuleNavLeaf[];
};

export type ModuleNavContribution = ModuleNavLeaf | ModuleNavParent;

export function isModuleNavParent(
  nav: ModuleNavContribution,
): nav is ModuleNavParent {
  return "items" in nav;
}

/**
 * Self-contained manifest for a studio module. Each module exports one of
 * these from `features/<id>/module.ts` and registers itself by being added
 * to `lib/modules/registry.ts`. The studio assembles the sidebar, command
 * palette, breadcrumbs and route guard from this list at request time.
 */
export type StudioModule = {
  /** Stable kebab-case identifier. Used in the cookie and as a cross-ref. */
  id: string;
  /** Raw label shown when no i18n key is configured or the message is missing. */
  title: string;
  /** next-intl key, e.g. "modules.alterations.title". Falls back to `title`. */
  i18nKey?: string;
  /** Description shown on the Settings → Modules toggle page. */
  description?: string;
  /** Which sidebar group this module belongs to (e.g. "General", "Settings"). */
  navGroup: string;
  /** Sidebar entry contributed by this module. */
  nav: ModuleNavContribution;
  /** Optional semantic colour tint applied to the icon tile. */
  tint?: NavTint;
  /** Route prefixes this module owns — used by middleware to block disabled URLs. */
  ownedPaths: string[];
  /** Required modules cannot be disabled from the settings page. */
  required?: boolean;
  /** Initial enabled state when no cookie preference is set (defaults to true). */
  defaultEnabled?: boolean;
};
