import "server-only";
import { cookies } from "next/headers";

import { MODULES_COOKIE, parseEnabledCookie } from "./route-manifest";

/**
 * Returns the ids of modules that are currently enabled. Reads the
 * `elsa_modules` cookie and falls back to the per-module `defaultEnabled`
 * plus `required` set when no preference has been saved yet.
 */
export async function getEnabledModuleIds(): Promise<string[]> {
  const store = await cookies();
  const raw = store.get(MODULES_COOKIE)?.value;
  return parseEnabledCookie(raw);
}
