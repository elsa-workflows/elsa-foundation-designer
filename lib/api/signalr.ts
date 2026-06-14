"use client";

import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
  type ILogger,
} from "@microsoft/signalr";
import { useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { getAccessToken } from "@/lib/api/token-store";
import { getEngineById } from "@/lib/engines/registry";
import {
  getActiveEngineId,
  subscribeActiveEngine,
} from "@/lib/engines/active-engine-store";

type EngineHub = {
  connection: HubConnection | null;
  starting: Promise<void> | null;
  stateHandlersInstalledOn: HubConnection | null;
};

const hubs = new Map<string, EngineHub>();

function ensureHubSlot(engineId: string): EngineHub {
  let h = hubs.get(engineId);
  if (!h) {
    h = { connection: null, starting: null, stateHandlersInstalledOn: null };
    hubs.set(engineId, h);
  }
  return h;
}

type ConnectionStateListener = (state: HubConnectionState) => void;
// Listeners keyed by engineId (the empty string "" is the "active engine"
// bucket — listeners that auto-follow whichever engine is active).
const connectionStateListeners = new Map<string, Set<ConnectionStateListener>>();

function notifyConnectionStateListeners(
  engineId: string,
  state: HubConnectionState,
) {
  const direct = connectionStateListeners.get(engineId);
  if (direct) for (const l of direct) l(state);
  if (engineId === getActiveEngineId()) {
    const active = connectionStateListeners.get("");
    if (active) for (const l of active) l(state);
  }
}

function installStateHandlers(engineId: string, conn: HubConnection) {
  const slot = ensureHubSlot(engineId);
  if (slot.stateHandlersInstalledOn === conn) return;
  slot.stateHandlersInstalledOn = conn;
  conn.onreconnecting(() =>
    notifyConnectionStateListeners(engineId, HubConnectionState.Reconnecting),
  );
  conn.onreconnected(() =>
    notifyConnectionStateListeners(engineId, HubConnectionState.Connected),
  );
  conn.onclose(() =>
    notifyConnectionStateListeners(engineId, HubConnectionState.Disconnected),
  );
}

/**
 * Custom logger that demotes every SignalR log line to `console.debug`. The
 * hub is best-effort: when the backend is unreachable the app falls back to
 * REST polling at the React Query layer, so SignalR's own `console.error`
 * spam ("Failed to complete negotiation with the server") is misleading
 * noise. Anyone debugging the hub can enable "Verbose" logging in DevTools
 * to see these.
 */
const quietLogger: ILogger = {
  log(logLevel: LogLevel, message: string) {
    if (logLevel === LogLevel.None || logLevel === LogLevel.Trace) return;
    console.debug(`[signalr] ${message}`);
  },
};

function buildHubUrl(engineId: string): string | null {
  const engine = getEngineById(engineId);
  if (!engine) return null;
  return `${engine.url.replace(/\/$/, "")}/hubs/workflow-instances`;
}

/**
 * Lazily create + start a single SignalR connection per engine. Multiple
 * subscribers share the same connection so we don't open redundant sockets.
 *
 * Backend hub path mirrors Blazor's `SignalRWorkflowInstanceObserver`:
 *   `<API_BASE>/hubs/workflow-instances`
 */
async function ensureConnected(engineId: string): Promise<HubConnection> {
  const slot = ensureHubSlot(engineId);
  if (
    slot.connection &&
    slot.connection.state === HubConnectionState.Connected
  ) {
    return slot.connection;
  }
  if (!slot.connection) {
    const hubUrl = buildHubUrl(engineId);
    if (!hubUrl) {
      throw new Error(`Unknown engine: ${engineId}`);
    }
    slot.connection = new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => getAccessToken(engineId) ?? "",
      })
      .withAutomaticReconnect()
      .configureLogging(quietLogger)
      .build();
    installStateHandlers(engineId, slot.connection);
  }
  if (
    slot.connection.state === HubConnectionState.Disconnected &&
    !slot.starting
  ) {
    notifyConnectionStateListeners(engineId, HubConnectionState.Connecting);
    slot.starting = slot.connection
      .start()
      .then(() => {
        notifyConnectionStateListeners(engineId, HubConnectionState.Connected);
      })
      .catch((err) => {
        notifyConnectionStateListeners(
          engineId,
          HubConnectionState.Disconnected,
        );
        throw err;
      })
      .finally(() => {
        slot.starting = null;
      });
  }
  if (slot.starting) {
    try {
      await slot.starting;
    } catch {
      // Swallow — the caller will retry on the next subscription.
    }
  }
  return slot.connection;
}

/**
 * Tear down the connection for one engine. Safe to call before switching
 * engines so the old hub doesn't keep streaming events into the cache.
 */
export async function tearDownConnection(engineId: string): Promise<void> {
  const slot = hubs.get(engineId);
  if (!slot?.connection) return;
  const conn = slot.connection;
  slot.connection = null;
  slot.starting = null;
  slot.stateHandlersInstalledOn = null;
  try {
    await conn.stop();
  } catch {
    // Ignore — best-effort teardown.
  }
  notifyConnectionStateListeners(engineId, HubConnectionState.Disconnected);
}

/**
 * Read the hub URL without forcing a connection. Useful for diagnostics UIs
 * that want to show what we *would* connect to even when the hub hasn't been
 * started yet.
 */
export function getSignalRHubUrl(engineId?: string): string {
  const id = engineId ?? getActiveEngineId();
  return buildHubUrl(id) ?? "";
}

/**
 * Snapshot the current connection state. Returns `Disconnected` if the
 * shared connection hasn't been created yet for this engine.
 */
export function getSignalRConnectionState(
  engineId?: string,
): HubConnectionState {
  const id = engineId ?? getActiveEngineId();
  return hubs.get(id)?.connection?.state ?? HubConnectionState.Disconnected;
}

/**
 * Subscribe to hub connection-state changes for the active engine (or a
 * specific one when given). Side effect: starts the hub for that engine if
 * it isn't started yet. Returns an unsubscribe.
 *
 * Listeners get fired on:
 *   - The initial transition to `Connecting` triggered by this subscribe call.
 *   - Every reconnecting / reconnected / close transition reported by SignalR.
 *   - The final `Connected` / `Disconnected` outcome of the initial start.
 */
export function subscribeToConnectionState(
  listener: ConnectionStateListener,
): () => void;
export function subscribeToConnectionState(
  engineId: string,
  listener: ConnectionStateListener,
): () => void;
export function subscribeToConnectionState(
  arg1: string | ConnectionStateListener,
  arg2?: ConnectionStateListener,
): () => void {
  const explicitId = typeof arg1 === "string" ? arg1 : null;
  const listener =
    typeof arg1 === "function" ? arg1 : (arg2 as ConnectionStateListener);
  const key = explicitId ?? "";
  let bucket = connectionStateListeners.get(key);
  if (!bucket) {
    bucket = new Set();
    connectionStateListeners.set(key, bucket);
  }
  bucket.add(listener);
  const targetId = explicitId ?? getActiveEngineId();
  listener(getSignalRConnectionState(targetId));
  void ensureConnected(targetId).catch(() => {
    // ensureConnected already notifies on failure — nothing to do here.
  });
  return () => {
    bucket?.delete(listener);
  };
}

// When the active engine changes, re-emit state to "active engine" listeners
// so any UI bound to the active hub re-renders against the new engine.
subscribeActiveEngine((id) => {
  const active = connectionStateListeners.get("");
  if (!active || active.size === 0) return;
  const state = getSignalRConnectionState(id);
  for (const l of active) l(state);
  void ensureConnected(id).catch(() => {
    // ignore
  });
});

/**
 * Subscribe to live updates for a workflow instance on the active engine.
 * Returns nothing; the hook simply invalidates the relevant React Query
 * keys when the backend pushes an event.
 *
 * Falls back silently when the hub isn't reachable — polling at the query
 * level takes over.
 */
export function useWorkflowInstanceLiveUpdates(instanceId: string | undefined): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!instanceId) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const engineId = getActiveEngineId();

    (async () => {
      let connection: HubConnection;
      try {
        connection = await ensureConnected(engineId);
      } catch {
        return;
      }
      if (cancelled) return;

      try {
        // Most hubs expose a per-instance subscribe; if the server doesn't,
        // these calls will throw and we silently fall back to polling.
        await connection.invoke("SubscribeToInstance", instanceId);
      } catch {
        // Continue — some hubs send all events to all clients.
      }

      const invalidateInstanceKeys = () => {
        qc.invalidateQueries({ queryKey: ["workflow-instance", instanceId] });
        qc.invalidateQueries({ queryKey: ["workflow-instance-variables", instanceId] });
        qc.invalidateQueries({ queryKey: ["activity-execution-summaries", instanceId] });
        qc.invalidateQueries({ queryKey: ["workflow-execution-log", instanceId] });
      };
      const onUpdated = (incoming: string) => {
        if (incoming !== instanceId) return;
        invalidateInstanceKeys();
      };
      const onAnyChange = () => invalidateInstanceKeys();

      connection.on("WorkflowInstanceUpdated", onUpdated);
      connection.on("ActivityExecuted", onAnyChange);
      connection.on("WorkflowExecuted", onAnyChange);
      // Mirrors Blazor's `WorkflowExecutionLogUpdatedAsync` — server emits this
      // when a new entry is appended to the journal.
      connection.on("WorkflowExecutionLogUpdated", onAnyChange);
      connection.on("ActivityExecutionLogUpdated", onAnyChange);

      cleanup = () => {
        connection.off("WorkflowInstanceUpdated", onUpdated);
        connection.off("ActivityExecuted", onAnyChange);
        connection.off("WorkflowExecuted", onAnyChange);
        connection.off("WorkflowExecutionLogUpdated", onAnyChange);
        connection.off("ActivityExecutionLogUpdated", onAnyChange);
        connection.invoke("UnsubscribeFromInstance", instanceId).catch(() => {
          // ignore — same forgiveness as on subscribe
        });
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [instanceId, qc]);
}

/**
 * Subscribe to every WorkflowInstanceUpdated event on the active engine's
 * hub. The handler receives the instance id that changed. Cleanup is
 * automatic on unmount.
 */
export function useGlobalInstanceEvents(
  handler: (instanceId: string) => void,
): void {
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const engineId = getActiveEngineId();

    (async () => {
      let connection: HubConnection;
      try {
        connection = await ensureConnected(engineId);
      } catch {
        return;
      }
      if (cancelled) return;

      const onUpdated = (incoming: string) => handler(incoming);
      connection.on("WorkflowInstanceUpdated", onUpdated);
      connection.on("WorkflowExecuted", onUpdated);

      cleanup = () => {
        connection.off("WorkflowInstanceUpdated", onUpdated);
        connection.off("WorkflowExecuted", onUpdated);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [handler]);
}

/**
 * Plan Details live updates. Listens for any WorkflowInstanceUpdated and
 * invalidates the alteration-plan query — the plan payload is small and
 * the jobs reference different instance ids, so a blanket invalidation is
 * the simplest correct behaviour.
 */
export function useAlterationPlanLiveUpdates(
  planId: string | undefined,
): void {
  const qc = useQueryClient();

  useEffect(() => {
    if (!planId) return;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    const engineId = getActiveEngineId();

    (async () => {
      let connection: HubConnection;
      try {
        connection = await ensureConnected(engineId);
      } catch {
        return;
      }
      if (cancelled) return;

      const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["alteration-plan", planId] });
      };
      connection.on("WorkflowInstanceUpdated", invalidate);
      connection.on("WorkflowExecuted", invalidate);

      cleanup = () => {
        connection.off("WorkflowInstanceUpdated", invalidate);
        connection.off("WorkflowExecuted", invalidate);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [planId, qc]);
}
