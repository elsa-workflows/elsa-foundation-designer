"use client";

import { useEffect, useState } from "react";

import {
  getApiHealth,
  subscribeToApiHealth,
  type ApiHealthState,
} from "@/lib/api/health";
import { useActiveEngineStore } from "@/lib/engines/active-engine-store";

/**
 * Subscribe to the REST API health monitor for one engine. When `engineId`
 * is omitted the hook tracks whichever engine is currently active and
 * automatically re-subscribes if the user switches engines.
 *
 * The first mount of this hook anywhere for a given engine starts that
 * engine's polling interval; cleanup is automatic.
 */
export function useElsaApiHealth(engineId?: string): ApiHealthState {
  const activeEngineId = useActiveEngineStore((s) => s.activeEngineId);
  const targetId = engineId ?? activeEngineId;

  const [snapshot, setSnapshot] = useState<ApiHealthState>(() =>
    getApiHealth(targetId),
  );

  useEffect(() => {
    // subscribeToApiHealth fires the listener synchronously with the
    // current state for `targetId`, so we don't need to call setSnapshot
    // explicitly when the engine changes.
    return subscribeToApiHealth(targetId, setSnapshot);
  }, [targetId]);

  return snapshot;
}
