import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  COOKIES,
  accessTokenCookieName,
  persistMarkerCookieName,
  refreshTokenCookieName,
} from "@/lib/config";
import {
  ElsaAuthError,
  elsaRefresh,
  lifetimeFromMarker,
  persistMarkerCookieOptions,
  refreshCookieOptions,
  tokenCookieOptions,
} from "@/lib/auth/server";
import { getServerEngineById, listServerEngines } from "@/lib/engines/server-registry";
import { decodeAccessToken, displayName, isExpired } from "@/lib/auth/session";

/**
 * Returns the current session for the requested engine (`?engineId=…`),
 * refreshing server-side when the access token is missing or near-expired.
 * Defaults to the cookie-recorded active engine, then the first server-
 * allowlisted engine.
 *
 * Returns 401 only when both the access JWT and the refresh cookie for that
 * engine are unusable (e.g. user logged out, refresh expired on Elsa, or
 * never logged in to this engine).
 */
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const requested = req.nextUrl.searchParams.get("engineId");
  const engineId =
    requested ??
    jar.get(COOKIES.activeEngine)?.value ??
    listServerEngines()[0]?.id;

  if (!engineId || !getServerEngineById(engineId)) {
    return NextResponse.json(
      { authenticated: false, error: "Engine not allowlisted on this server." },
      { status: 403 },
    );
  }

  const at = jar.get(accessTokenCookieName(engineId))?.value;
  const rt = jar.get(refreshTokenCookieName(engineId))?.value;

  // Fast path: valid, non-expired access token.
  if (at) {
    try {
      const session = decodeAccessToken(at);
      if (!isExpired(session.claims)) {
        return NextResponse.json({
          authenticated: true,
          engineId,
          accessToken: session.accessToken,
          expiresAt: session.expiresAt ?? null,
          user: {
            name: displayName(session.claims),
            email: session.claims.email ?? null,
            sub: session.claims.sub ?? null,
          },
        });
      }
    } catch {
      // Malformed JWT — fall through to the refresh attempt.
    }
  }

  // Need to refresh. Bail if we have nothing to refresh with.
  if (!rt) {
    return NextResponse.json({ authenticated: false, engineId }, { status: 401 });
  }

  const lifetime = lifetimeFromMarker(
    jar.get(persistMarkerCookieName(engineId))?.value,
  );

  try {
    const pair = await elsaRefresh(engineId, rt);
    const session = decodeAccessToken(pair.accessToken);
    const res = NextResponse.json({
      authenticated: true,
      engineId,
      accessToken: pair.accessToken,
      expiresAt: session.expiresAt ?? null,
      user: {
        name: displayName(session.claims),
        email: session.claims.email ?? null,
        sub: session.claims.sub ?? null,
      },
    });
    res.cookies.set(
      accessTokenCookieName(engineId),
      pair.accessToken,
      tokenCookieOptions(pair.accessToken, lifetime),
    );
    res.cookies.set(
      refreshTokenCookieName(engineId),
      pair.refreshToken,
      refreshCookieOptions(lifetime),
    );
    // Re-stamp the marker so it doesn't expire ahead of the auth cookies.
    res.cookies.set(
      persistMarkerCookieName(engineId),
      lifetime === "persistent" ? "1" : "0",
      persistMarkerCookieOptions(lifetime),
    );
    return res;
  } catch (err) {
    const status = err instanceof ElsaAuthError ? err.status : 0;
    const res = NextResponse.json(
      {
        authenticated: false,
        engineId,
        error: err instanceof Error ? err.message : "Refresh failed",
      },
      { status: status === 401 ? 401 : 502 },
    );
    if (status === 401) {
      res.cookies.delete(accessTokenCookieName(engineId));
      res.cookies.delete(refreshTokenCookieName(engineId));
    }
    return res;
  }
}
