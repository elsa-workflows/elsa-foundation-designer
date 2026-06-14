"use client";

import { useEffect, useState } from "react";

/**
 * Allowed auto-refresh intervals (ms) for the instances list + viewer. `0`
 * means polling is off — `getRefetchInterval` returns `undefined` in that case
 * so React Query disables the timer entirely.
 */
export const POLLING_OPTIONS = [0, 3000, 5000, 15000, 60000] as const;
export type PollingMs = (typeof POLLING_OPTIONS)[number];

const STORAGE_KEY = "elsa.instances.pollMs";
const DEFAULT_MS: PollingMs = 5000;

/** Translate the picker value into the `refetchInterval` shape React Query expects. */
export function getRefetchInterval(value: PollingMs): number | undefined {
  return value > 0 ? value : undefined;
}

/**
 * Shared polling-interval state for instance lists / viewer. Persists the
 * last-used choice in `localStorage` so cadence stays sticky across page loads.
 */
export function usePollingInterval(): {
  ms: PollingMs;
  setMs: (next: PollingMs) => void;
} {
  const [ms, setState] = useState<PollingMs>(DEFAULT_MS);

  // Read the persisted value after mount so SSR + first paint match.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = Number.parseInt(raw, 10);
    if (
      Number.isFinite(parsed) &&
      (POLLING_OPTIONS as readonly number[]).includes(parsed)
    ) {
      setState(parsed as PollingMs);
    }
  }, []);

  const setMs = (next: PollingMs) => {
    setState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    }
  };

  return { ms, setMs };
}
