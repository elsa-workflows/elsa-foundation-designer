import "server-only";

import { getServerEnv } from "@/lib/config";
import type { ServerEngineEntry } from "@/lib/engines/types";

/**
 * Server-side allowlist of engines that `/api/auth/*` route handlers are
 * permitted to forward credentials to. Sourced from the server `ELSA_ENGINES`
 * env (or the single-URL `ELSA_API_URL` fallback). Crucially this is NOT a
 * mirror of localStorage user-added engines — the user cannot extend what
 * the auth proxy talks to from the browser, which prevents SSRF.
 */
export function listServerEngines(): ServerEngineEntry[] {
  return getServerEnv().engines;
}

export function getServerEngineById(id: string): ServerEngineEntry | null {
  return listServerEngines().find((e) => e.id === id) ?? null;
}

export function isServerAllowlistedUrl(url: string): boolean {
  const normalized = url.replace(/\/$/, "");
  return listServerEngines().some((e) => e.url === normalized);
}
