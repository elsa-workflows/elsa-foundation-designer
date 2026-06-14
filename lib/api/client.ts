"use client";

import ky, { type KyInstance } from "ky";

import { getEngineById } from "@/lib/engines/registry";
import {
  getActiveEngineId,
  subscribeActiveEngine,
} from "@/lib/engines/active-engine-store";
import { getAccessToken, setAccessToken } from "@/lib/api/token-store";

/**
 * Single-flight refresh per engine: if a 401 happens while a refresh is
 * already in-flight for the same engine, subsequent callers await the same
 * promise instead of stampeding the server.
 *
 * We talk to `/api/auth/me?engineId=<id>` rather than `/api/auth/refresh`
 * directly. The `/me` route is the one place that does the access-cookie-or-
 * refresh negotiation — going through it means we never burn a one-time
 * refresh token by calling refresh from two paths in parallel (the React
 * Query session poller and the ky retry hook).
 */
const refreshInFlight = new Map<string, Promise<string | null>>();

async function refreshAccessToken(engineId?: string): Promise<string | null> {
  const id = engineId ?? getActiveEngineId();
  const existing = refreshInFlight.get(id);
  if (existing) return existing;
  const p = (async () => {
    try {
      const res = await fetch(
        `/api/auth/me?engineId=${encodeURIComponent(id)}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        },
      );
      if (!res.ok) {
        if (res.status === 401) setAccessToken(id, null);
        return null;
      }
      const body = (await res.json()) as {
        authenticated?: boolean;
        accessToken?: string;
        expiresAt?: number | null;
      };
      if (!body.authenticated || !body.accessToken) {
        setAccessToken(id, null);
        return null;
      }
      setAccessToken(id, body.accessToken, body.expiresAt ?? null);
      return body.accessToken;
    } catch {
      setAccessToken(id, null);
      return null;
    } finally {
      refreshInFlight.delete(id);
    }
  })();
  refreshInFlight.set(id, p);
  return p;
}

const clientCache = new Map<string, KyInstance>();

function buildClient(engineId: string): KyInstance {
  const engine = getEngineById(engineId);
  if (!engine) {
    throw new Error(`Unknown engine: ${engineId}`);
  }
  return ky.create({
    prefix: engine.url,
    timeout: 30_000,
    // Auto-retry once on 401 across all methods. ky preserves the body
    // internally (unlike re-fetching a consumed Request), so this works for
    // POST/PUT save flows — not only GETs.
    retry: {
      limit: 1,
      statusCodes: [401],
      methods: ["get", "post", "put", "patch", "delete"],
      delay: () => 0,
    },
    hooks: {
      beforeRequest: [
        ({ request }) => {
          const token = getAccessToken(engineId);
          if (token) request.headers.set("Authorization", `Bearer ${token}`);
        },
      ],
      beforeRetry: [
        async ({ request }) => {
          const newToken = await refreshAccessToken(engineId);
          if (!newToken) {
            // Skip the retry and let the original 401 bubble up so the auth
            // layer can route the user to /login.
            return ky.stop;
          }
          request.headers.set("Authorization", `Bearer ${newToken}`);
        },
      ],
    },
  });
}

export function getElsaClient(engineId?: string): KyInstance {
  const id = engineId ?? getActiveEngineId();
  let inst = clientCache.get(id);
  if (!inst) {
    inst = buildClient(id);
    clientCache.set(id, inst);
  }
  return inst;
}

// When the user adds/removes engines we may need to evict cached clients
// whose underlying url changed. The switch action calls this on demand.
export function evictClientCache(engineId?: string): void {
  if (engineId) clientCache.delete(engineId);
  else clientCache.clear();
}

// Re-route requests when the active engine changes — but we don't have to
// do anything explicitly here because the Proxy below resolves the active
// engine on every property access.
subscribeActiveEngine(() => {});

/**
 * Always-current Ky instance bound to the active engine. Existing call
 * sites (`elsa.get(...)`, `elsa.post(...)`, etc.) keep working unchanged:
 * each access resolves the underlying instance for whichever engine is
 * active right now.
 */
export const elsa: KyInstance = new Proxy({} as KyInstance, {
  get(_target, prop, receiver) {
    const instance = getElsaClient();
    const value = Reflect.get(instance as object, prop, receiver);
    return typeof value === "function" ? value.bind(instance) : value;
  },
  apply(_target, _thisArg, args) {
    // Support `elsa(input, options)` if anyone calls it that way.
    const instance = getElsaClient();
    return (instance as unknown as (...a: unknown[]) => unknown)(...args);
  },
}) as KyInstance;

export { refreshAccessToken };
