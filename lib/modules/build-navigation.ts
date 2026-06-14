import type { ComponentType } from "react";

import {
  isModuleNavParent,
  type NavTint,
  type ModuleNavLeaf,
  type ModuleNavParent,
  type StudioModule,
} from "./types";

export type NavLeaf = {
  title: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  placeholder?: boolean;
  tint?: NavTint;
  moduleId?: string;
  i18nKey?: string;
};

export type NavParent = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  basePath: string;
  items: NavLeaf[];
  tint?: NavTint;
  moduleId?: string;
  i18nKey?: string;
};

export type NavItem = NavLeaf | NavParent;

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export function isParent(item: NavItem): item is NavParent {
  return "items" in item;
}

const DEFAULT_TINT: NavTint = {
  bg: "bg-slate-500/10",
  fg: "text-slate-600 dark:text-slate-400",
  glow: "shadow-slate-500/25",
};

function decorateLeaf(
  leaf: ModuleNavLeaf,
  module: StudioModule,
): NavLeaf {
  return {
    ...leaf,
    tint: module.tint ?? DEFAULT_TINT,
    moduleId: module.id,
  };
}

function decorateParent(
  parent: ModuleNavParent,
  module: StudioModule,
): NavParent {
  return {
    title: parent.title,
    icon: parent.icon,
    basePath: parent.basePath,
    items: parent.items.map((leaf) => decorateLeaf(leaf, module)),
    tint: module.tint ?? DEFAULT_TINT,
    moduleId: module.id,
    i18nKey: module.i18nKey,
  };
}

/**
 * Assemble the sidebar groups from a list of enabled modules. Group order
 * follows first-appearance in the input array, items within a group keep the
 * order they were registered.
 */
export function buildNavigation(
  modules: readonly StudioModule[],
): NavGroup[] {
  const byGroup = new Map<string, NavItem[]>();
  const order: string[] = [];
  for (const m of modules) {
    const item: NavItem = isModuleNavParent(m.nav)
      ? decorateParent(m.nav, m)
      : { ...decorateLeaf(m.nav, m), i18nKey: m.i18nKey };
    if (!byGroup.has(m.navGroup)) {
      byGroup.set(m.navGroup, []);
      order.push(m.navGroup);
    }
    byGroup.get(m.navGroup)!.push(item);
  }
  return order.map((title) => ({ title, items: byGroup.get(title)! }));
}

export function flattenLeaves(nav: readonly NavGroup[]): NavLeaf[] {
  return nav.flatMap((g) =>
    g.items.flatMap((i) => (isParent(i) ? i.items : [i])),
  );
}

export function flattenParents(nav: readonly NavGroup[]): NavParent[] {
  return nav.flatMap((g) => g.items.filter(isParent));
}

export function findNavLeaf(
  nav: readonly NavGroup[],
  pathname: string,
): NavLeaf | undefined {
  return flattenLeaves(nav).find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
}

export function findNavParent(
  nav: readonly NavGroup[],
  pathname: string,
): NavParent | undefined {
  return flattenParents(nav).find(
    (p) => pathname === p.basePath || pathname.startsWith(`${p.basePath}/`),
  );
}

export function isBranchActive(
  parent: NavParent,
  pathname: string,
): boolean {
  return pathname === parent.basePath || pathname.startsWith(`${parent.basePath}/`);
}
