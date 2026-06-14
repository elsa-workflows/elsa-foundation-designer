"use client";

import { getActiveEngineId } from "@/lib/engines/active-engine-store";
import { getEngineById } from "@/lib/engines/registry";

export type ApiHealthTone = "online" | "checking" | "offline";

export type ApiHealthState = {
  tone: ApiHealthTone;
  /** Short human label, e.g. "Reachable", "Unreachable", "Checking…". */
  label: string;
  /** Round-trip duration of the last completed ping, or `null` before one finishes. */
  latencyMs: number | null;
  /** `Date.now()` of the last completed ping, or `null` before one finishes. */
  checkedAt: number | null;
  /** Longer human-readable detail (HTTP status, error reason). */
  detail: string;
};

const INITIAL_STATE: ApiHealthState = {
  tone: "checking",
  label: "Checking…",
  latencyMs: null,
  checkedAt: null,
  detail: "Sending first request.",
};

const PING_INTERVAL_MS = 15_000;
const PING_TIMEOUT_MS = 5_000;

type Listener = (state: ApiHealthState) => void;

type EngineMonitor = {
  state: ApiHealthState;
  listeners: Set<Listener>;
  intervalId: ReturnType<typeof setInterval> | null;
  inFlight: boolean;
};

const monitors = new Map<string, EngineMonitor>();

function ensureMonitor(engineId: string): EngineMonitor {
  let m = monitors.get(engineId);
  if (!m) {
    m = {
      state: INITIAL_STATE,
      listeners: new Set(),
      intervalId: null,
      inFlight: false,
    };
    monitors.set(engineId, m);
  }
  return m;
}

function setState(monitor: EngineMonitor, next: ApiHealthState) {
  monitor.state = next;
  for (const l of monitor.listeners) l(monitor.state);
}

async function ping(engineId: string): Promise<ApiHealthState> {
  const engine = getEngineById(engineId);
  if (!engine) {
    return {
      tone: "offline",
      label: "Unknown engine",
      latencyMs: null,
      checkedAt: Date.now(),
      detail: `No engine registered with id "${engineId}".`,
    };
  }
  const baseUrl = engine.url.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    const res = await fetch(baseUrl, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
      // The base URL likely returns 401 / 404 without auth — both still
      // confirm the server is reachable.
      credentials: "omit",
    });
    const latencyMs = Math.round(performance.now() - startedAt);
    if (res.status >= 500) {
      return {
        tone: "offline",
        label: "Server error",
        latencyMs,
        checkedAt: Date.now(),
        detail: `HTTP ${res.status} from the API base URL.`,
      };
    }
    return {
      tone: "online",
      label: "Reachable",
      latencyMs,
      checkedAt: Date.now(),
      detail: `HTTP ${res.status} — server responded.`,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startedAt);
    const aborted = err instanceof DOMException && err.name === "AbortError";
    return {
      tone: "offline",
      label: aborted ? "Timed out" : "Unreachable",
      latencyMs,
      checkedAt: Date.now(),
      detail: aborted
        ? `No response within ${PING_TIMEOUT_MS / 1000}s.`
        : "Network request failed — server is not reachable.",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runPingOnce(engineId: string): Promise<void> {
  const monitor = ensureMonitor(engineId);
  if (monitor.inFlight) return;
  monitor.inFlight = true;
  try {
    const next = await ping(engineId);
    setState(monitor, next);
  } finally {
    monitor.inFlight = false;
  }
}

function ensureInterval(engineId: string) {
  const monitor = ensureMonitor(engineId);
  if (monitor.intervalId !== null) return;
  monitor.intervalId = setInterval(() => {
    void runPingOnce(engineId);
  }, PING_INTERVAL_MS);
}

function maybeStopInterval(engineId: string) {
  const monitor = monitors.get(engineId);
  if (!monitor) return;
  if (monitor.listeners.size > 0) return;
  if (monitor.intervalId !== null) {
    clearInterval(monitor.intervalId);
    monitor.intervalId = null;
  }
}

/**
 * Force an immediate ping for one engine (default: active). Returns when
 * the request completes. Safe to call from a "Refresh" button — concurrent
 * calls coalesce per engine.
 */
export function refreshApiHealth(engineId?: string): Promise<void> {
  const id = engineId ?? getActiveEngineId();
  return runPingOnce(id);
}

/**
 * Read the current snapshot without subscribing.
 */
export function getApiHealth(engineId?: string): ApiHealthState {
  const id = engineId ?? getActiveEngineId();
  return monitors.get(id)?.state ?? INITIAL_STATE;
}

/**
 * Subscribe to API health changes for one engine (default: active). The
 * first subscriber starts the polling interval and triggers an immediate
 * ping; the last subscriber leaving stops it. Returns an unsubscribe.
 */
export function subscribeToApiHealth(listener: Listener): () => void;
export function subscribeToApiHealth(
  engineId: string,
  listener: Listener,
): () => void;
export function subscribeToApiHealth(
  arg1: string | Listener,
  arg2?: Listener,
): () => void {
  const engineId = typeof arg1 === "string" ? arg1 : getActiveEngineId();
  const listener = typeof arg1 === "function" ? arg1 : (arg2 as Listener);
  const monitor = ensureMonitor(engineId);
  monitor.listeners.add(listener);
  listener(monitor.state);
  ensureInterval(engineId);
  // Kick off an immediate ping the first time anyone listens so we don't
  // wait up to PING_INTERVAL_MS for the first signal.
  if (monitor.state === INITIAL_STATE) {
    void runPingOnce(engineId);
  }
  return () => {
    monitor.listeners.delete(listener);
    maybeStopInterval(engineId);
  };
}
