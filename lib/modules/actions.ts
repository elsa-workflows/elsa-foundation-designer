"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { MODULES_COOKIE, MODULE_ROUTE_MANIFEST } from "./route-manifest";

/**
 * Persist the set of enabled modules in the `elsa_modules` cookie. Required
 * modules are always kept regardless of what the caller passes. Unknown ids
 * are dropped. Mirrors the pattern in `lib/i18n-actions.ts`.
 */
export async function setEnabledModules(ids: string[]): Promise<void> {
  const known = new Set(MODULE_ROUTE_MANIFEST.map((m) => m.id));
  const required = MODULE_ROUTE_MANIFEST.filter((m) => m.required).map((m) => m.id);
  const sanitized = ids.filter((id) => known.has(id));
  const final = Array.from(new Set([...sanitized, ...required]));

  const store = await cookies();
  store.set(MODULES_COOKIE, JSON.stringify(final), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/");
}
