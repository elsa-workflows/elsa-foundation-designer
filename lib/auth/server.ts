import "server-only";

import { cookies } from "next/headers";

import {
  COOKIES,
  accessTokenCookieName,
  persistMarkerCookieName,
  refreshTokenCookieName,
} from "@/lib/config";
import { getServerEngineById } from "@/lib/engines/server-registry";
import { decodeAccessToken, isExpired, type Session } from "@/lib/auth/session";

/**
 * Server-side session reader. Returns null when no access cookie is present
 * for the active engine or the JWT can't be decoded. Caller decides what to
 * do with an expired one (middleware redirects, /api/auth/me triggers
 * refresh).
 */
export async function getSession(engineId?: string): Promise<Session | null> {
  const jar = await cookies();
  const id = engineId ?? jar.get(COOKIES.activeEngine)?.value ?? null;
  if (!id) return null;
  const at = jar.get(accessTokenCookieName(id))?.value;
  if (!at) return null;
  try {
    return decodeAccessToken(at);
  } catch {
    return null;
  }
}

export type ElsaTokenPair = {
  isAuthenticated?: boolean;
  accessToken: string | null;
  refreshToken: string | null;
};

function resolveEngineUrl(engineId: string): string {
  const engine = getServerEngineById(engineId);
  if (!engine) {
    throw new ElsaAuthError(`Unknown engine: ${engineId}`, 403);
  }
  return engine.url.replace(/\/$/, "");
}

/**
 * Calls Elsa's /identity/login on the engine identified by `engineId`. The
 * id is checked against the server-side allowlist; an unknown id raises 403.
 *
 * Quirk: this endpoint returns HTTP 200 even when credentials are wrong —
 * the failure mode is `{ isAuthenticated: false, ... }` rather than a
 * non-2xx status. We translate that into a 401-shaped error here.
 */
export async function elsaLogin(
  engineId: string,
  username: string,
  password: string,
) {
  const baseUrl = resolveEngineUrl(engineId);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/identity/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[auth] login fetch threw:", err);
    throw new ElsaAuthError(
      err instanceof Error ? `Cannot reach Elsa: ${err.message}` : "Cannot reach Elsa",
      0,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(
      `[auth] login HTTP ${res.status} from ${baseUrl}/identity/login`,
      body,
    );
    throw new ElsaAuthError(
      `Login HTTP ${res.status}: ${body || res.statusText}`,
      res.status,
    );
  }

  const pair = (await res.json()) as ElsaTokenPair;
  if (!pair.isAuthenticated || !pair.accessToken || !pair.refreshToken) {
    throw new ElsaAuthError("Invalid username or password", 401);
  }
  return pair as { isAuthenticated: true; accessToken: string; refreshToken: string };
}

export async function elsaRefresh(engineId: string, refreshToken: string) {
  const baseUrl = resolveEngineUrl(engineId);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/identity/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
  } catch (err) {
    console.error("[auth] refresh fetch threw:", err);
    throw new ElsaAuthError(
      err instanceof Error ? `Cannot reach Elsa: ${err.message}` : "Cannot reach Elsa",
      0,
    );
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[auth] refresh HTTP ${res.status}`, body);
    throw new ElsaAuthError(`Refresh HTTP ${res.status}`, res.status);
  }

  const pair = (await res.json()) as ElsaTokenPair;
  if (!pair.isAuthenticated || !pair.accessToken || !pair.refreshToken) {
    throw new ElsaAuthError("Refresh rejected", 401);
  }
  return pair as { isAuthenticated: true; accessToken: string; refreshToken: string };
}

export class ElsaAuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Cookie lifetime mode. `"persistent"` keeps the cookie across browser
 * restarts ("Remember me"); `"session"` makes it vanish when the browser
 * window closes. The login route picks the mode; refresh/me preserve it
 * via the `elsa_persist_<engineId>` marker cookie.
 */
export type CookieLifetime = "persistent" | "session";

const PERSISTENT_MAX_AGE = 60 * 60 * 24 * 30;

export function tokenCookieOptions(
  _token: string,
  lifetime: CookieLifetime = "persistent",
) {
  // We deliberately DON'T tie the cookie's lifetime to the JWT's `exp`.
  // The cookie surviving past the JWT exp is what lets `/api/auth/me` (and
  // server-side reads) notice the expiry and trigger a refresh — if the
  // cookie evaporates the moment the JWT expires, the only signal left is
  // "no session", which forces the user to re-login even though the
  // refresh token is still valid.
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  return lifetime === "persistent"
    ? { ...base, maxAge: PERSISTENT_MAX_AGE }
    : base;
}

export function refreshCookieOptions(
  lifetime: CookieLifetime = "persistent",
) {
  // Refresh tokens last longer than access tokens; we don't know their exact
  // expiry without decoding (they're opaque on Elsa). Use a 30-day window and
  // let the server reject if invalid — or no maxAge at all when the user
  // unchecked "Remember me".
  const base = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  return lifetime === "persistent"
    ? { ...base, maxAge: PERSISTENT_MAX_AGE }
    : base;
}

/**
 * Options for the non-HTTP-only `elsa_persist_<engineId>` marker cookie.
 * Same lifetime as the auth cookies it tracks, so it disappears with them
 * in both "Remember me" modes.
 */
export function persistMarkerCookieOptions(lifetime: CookieLifetime) {
  const base = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  return lifetime === "persistent"
    ? { ...base, maxAge: PERSISTENT_MAX_AGE }
    : base;
}

export function activeEngineCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}

/**
 * Decide whether refreshed cookies should be persistent or session-scoped
 * by reading the marker the login route wrote. Missing marker → persistent
 * (the historical default before "Remember me" existed).
 */
export function lifetimeFromMarker(
  markerValue: string | undefined,
): CookieLifetime {
  return markerValue === "0" ? "session" : "persistent";
}

/**
 * Per-engine cookie name helpers re-exported for convenience.
 */
export {
  accessTokenCookieName,
  persistMarkerCookieName,
  refreshTokenCookieName,
};

export { isExpired };
