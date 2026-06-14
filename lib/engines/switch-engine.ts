"use client";

import type { QueryClient } from "@tanstack/react-query";
import type { useRouter } from "next/navigation";

import {
  getActiveEngineId,
  useActiveEngineStore,
} from "@/lib/engines/active-engine-store";
import { getEngineById } from "@/lib/engines/registry";
import { evictClientCache } from "@/lib/api/client";
import { tearDownConnection } from "@/lib/api/signalr";
import { getAccessToken } from "@/lib/api/token-store";

type Router = ReturnType<typeof useRouter>;

export type SwitchEngineOptions = {
  router: Router;
  queryClient: QueryClient;
  /**
   * Where to land after a successful switch. Defaults to /dashboard so we
   * never end up on a page whose entity id only exists on the previous
   * engine.
   */
  next?: string;
};

/**
 * Full-reset engine switch.
 *
 * 1. Bail with a redirect to /login when the target engine has no cached
 *    session, since calling React Query against it would just 401.
 * 2. Tear down the previous engine's SignalR hub so it doesn't keep
 *    streaming events into a query cache that's about to be wiped.
 * 3. Flip the active engine (this also writes the elsa_active_engine
 *    cookie, which middleware reads on the next navigation).
 * 4. Evict any cached Ky instance for the previous engine — the Proxy in
 *    lib/api/client.ts will rebuild on next use, but eviction keeps memory
 *    tidy when the user adds/removes engines later.
 * 5. queryClient.clear() — wipe React Query cache so we never flash data
 *    from the previous engine before the new one's refetch lands.
 * 6. Hard-navigate to `next` (default /dashboard) so route-scoped pages
 *    (e.g. /workflow-definitions/[id]/edit) don't try to refetch entities
 *    that don't exist on the new engine.
 */
export function switchEngine(
  targetEngineId: string,
  { router, queryClient, next = "/dashboard" }: SwitchEngineOptions,
): void {
  const currentId = getActiveEngineId();
  if (targetEngineId === currentId) return;

  if (!getEngineById(targetEngineId)) {
    throw new Error(`Unknown engine: ${targetEngineId}`);
  }

  // No cached session? Send the user through /login to mint one. The login
  // form prefills the engine id from the query param.
  if (!getAccessToken(targetEngineId)) {
    router.push(
      `/login?engineId=${encodeURIComponent(targetEngineId)}&next=${encodeURIComponent(next)}`,
    );
    return;
  }

  void tearDownConnection(currentId);
  useActiveEngineStore.getState().setActiveEngine(targetEngineId);
  evictClientCache(currentId);
  queryClient.clear();
  router.replace(next);
  router.refresh();
}
