"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { ALL_MODULES } from "@/lib/modules/registry";
import {
  buildNavigation,
  flattenLeaves,
  flattenParents,
  type NavGroup,
  type NavLeaf,
  type NavParent,
} from "@/lib/modules/build-navigation";

type NavContextValue = {
  navigation: NavGroup[];
  allLeaves: NavLeaf[];
  allParents: NavParent[];
};

const NavContext = createContext<NavContextValue | null>(null);

/**
 * Provides the assembled sidebar navigation derived from the currently
 * enabled modules. Place this inside the (app) layout so it can read the
 * enabled-module ids resolved server-side from the cookie.
 *
 * The component is intentionally client-side: shell consumers (sidebar,
 * command palette, breadcrumbs) all need `usePathname()` and similar client
 * hooks, so a single context provider keeps things consistent.
 */
export function NavProvider({
  enabledIds,
  children,
}: {
  enabledIds: string[];
  children: ReactNode;
}) {
  const value = useMemo<NavContextValue>(() => {
    const enabled = new Set(enabledIds);
    const active = ALL_MODULES.filter((m) => enabled.has(m.id));
    const navigation = buildNavigation(active);
    return {
      navigation,
      allLeaves: flattenLeaves(navigation),
      allParents: flattenParents(navigation),
    };
  }, [enabledIds]);

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) {
    throw new Error("useNav must be called inside a <NavProvider>.");
  }
  return ctx;
}
