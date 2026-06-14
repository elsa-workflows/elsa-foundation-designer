"use client";

import {
  getActiveEngineId,
  subscribeActiveEngine,
} from "@/lib/engines/active-engine-store";

/**
 * Per-engine access-token store. The httpOnly refresh cookie stays on the
 * server side (one cookie per engine: `elsa_rt_<engineId>`); the browser
 * only ever holds the short-lived access token in memory, sourced from
 * /api/auth/me?engineId=<id>. Cleared on logout / refresh failure.
 *
 * Zero-arg accessors target the currently active engine, so legacy call
 * sites keep working unchanged.
 */

type TokenSlot = {
  token: string | null;
  expiresAt: number | null;
};

type Listener = (token: string | null) => void;

const slots = new Map<string, TokenSlot>();
// Listeners keyed by engineId, plus a synthetic "" bucket for listeners
// who track whichever engine is currently active.
const listenersByEngine = new Map<string, Set<Listener>>();

function ensureSlot(engineId: string): TokenSlot {
  let s = slots.get(engineId);
  if (!s) {
    s = { token: null, expiresAt: null };
    slots.set(engineId, s);
  }
  return s;
}

function notifyEngine(engineId: string, token: string | null) {
  const direct = listenersByEngine.get(engineId);
  if (direct) for (const l of direct) l(token);
  // The "active engine" bucket also fires when the active engine is the
  // one whose slot just changed.
  if (engineId === getActiveEngineId()) {
    const active = listenersByEngine.get("");
    if (active) for (const l of active) l(token);
  }
}

// When the active engine changes, re-emit to "active" listeners so React
// state hooked to "the current engine's token" updates immediately.
subscribeActiveEngine((id) => {
  const active = listenersByEngine.get("");
  if (!active) return;
  const slot = slots.get(id);
  const token = slot?.token ?? null;
  for (const l of active) l(token);
});

export function getAccessToken(engineId?: string): string | null {
  const id = engineId ?? getActiveEngineId();
  return slots.get(id)?.token ?? null;
}

export function getExpiresAt(engineId?: string): number | null {
  const id = engineId ?? getActiveEngineId();
  return slots.get(id)?.expiresAt ?? null;
}

export function setAccessToken(
  tokenOrEngineId: string | null,
  expOrToken: number | string | null = null,
  expMaybe: number | null = null,
): void {
  // Overloads:
  //   setAccessToken(token, expiresAt?)            — legacy, targets active engine
  //   setAccessToken(engineId, token, expiresAt?)  — new, explicit engine
  let engineId: string;
  let token: string | null;
  let expiresAt: number | null;
  if (typeof expOrToken === "string" || expOrToken === null) {
    if (typeof tokenOrEngineId === "string" && typeof expOrToken === "string") {
      engineId = tokenOrEngineId;
      token = expOrToken;
      expiresAt = expMaybe ?? null;
    } else if (
      typeof tokenOrEngineId === "string" &&
      expOrToken === null &&
      expMaybe === null
    ) {
      // Ambiguous: one string arg. Treat as token-for-active-engine.
      engineId = getActiveEngineId();
      token = tokenOrEngineId;
      expiresAt = null;
    } else {
      engineId = getActiveEngineId();
      token = tokenOrEngineId;
      expiresAt = (expOrToken as null) ?? null;
    }
  } else {
    // expOrToken is number → legacy signature (token, expiresAt)
    engineId = getActiveEngineId();
    token = tokenOrEngineId;
    expiresAt = expOrToken;
  }
  const slot = ensureSlot(engineId);
  slot.token = token;
  slot.expiresAt = expiresAt;
  notifyEngine(engineId, token);
}

/**
 * Subscribe to token changes. Pass an explicit engineId to track one
 * engine, or omit it to track whichever engine is currently active.
 * Returns an unsubscribe.
 */
export function subscribe(listener: Listener): () => void;
export function subscribe(engineId: string, listener: Listener): () => void;
export function subscribe(
  arg1: string | Listener,
  arg2?: Listener,
): () => void {
  const engineId = typeof arg1 === "string" ? arg1 : "";
  const listener = typeof arg1 === "function" ? arg1 : (arg2 as Listener);
  let bucket = listenersByEngine.get(engineId);
  if (!bucket) {
    bucket = new Set();
    listenersByEngine.set(engineId, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket?.delete(listener);
  };
}

export function isExpiringSoon(skewMs = 60_000, engineId?: string): boolean {
  const id = engineId ?? getActiveEngineId();
  const slot = slots.get(id);
  if (!slot?.expiresAt) return false;
  return slot.expiresAt - skewMs <= Date.now();
}

export function clearAllTokens(): void {
  for (const [id] of slots) {
    const slot = slots.get(id)!;
    slot.token = null;
    slot.expiresAt = null;
    notifyEngine(id, null);
  }
}
