"use client";

import { create } from "zustand";

import { COOKIES } from "@/lib/config";
import { getDefaultEngineId, getEngineById } from "@/lib/engines/registry";

type ActiveEngineListener = (engineId: string) => void;

const activeEngineListeners = new Set<ActiveEngineListener>();

function notifyActiveEngine(id: string) {
  for (const l of activeEngineListeners) l(id);
}

/**
 * Subscribe to active-engine changes outside of React (e.g. token store,
 * health pinger, Ky client). The listener fires synchronously on subscribe
 * with the current value so callers don't need a separate read.
 */
export function subscribeActiveEngine(
  listener: ActiveEngineListener,
): () => void {
  activeEngineListeners.add(listener);
  listener(useActiveEngineStore.getState().activeEngineId);
  return () => {
    activeEngineListeners.delete(listener);
  };
}

function readCookieEngineId(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${COOKIES.activeEngine}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(COOKIES.activeEngine.length + 1));
}

function writeCookieEngineId(id: string): void {
  if (typeof document === "undefined") return;
  const oneYear = 60 * 60 * 24 * 365;
  // Not HTTP-only: middleware needs it but the client also writes it. It
  // doesn't carry sensitive data — just a routing hint that pairs with the
  // engine-scoped HTTP-only token cookies.
  document.cookie = `${COOKIES.activeEngine}=${encodeURIComponent(id)}; Path=/; Max-Age=${oneYear}; SameSite=Lax`;
}

function resolveInitialActiveEngine(): string {
  const fromCookie = readCookieEngineId();
  if (fromCookie && getEngineById(fromCookie)) return fromCookie;
  return getDefaultEngineId();
}

type State = {
  activeEngineId: string;
  setActiveEngine: (id: string) => void;
};

export const useActiveEngineStore = create<State>((set) => ({
  activeEngineId: resolveInitialActiveEngine(),
  setActiveEngine: (id) => {
    writeCookieEngineId(id);
    set({ activeEngineId: id });
    notifyActiveEngine(id);
  },
}));

/** Imperative read for non-React callers. */
export function getActiveEngineId(): string {
  return useActiveEngineStore.getState().activeEngineId;
}
