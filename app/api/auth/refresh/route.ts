import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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
import { decodeAccessToken } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const jar = await cookies();
  const requested = req.nextUrl.searchParams.get("engineId");
  const engineId =
    requested ??
    jar.get(COOKIES.activeEngine)?.value ??
    listServerEngines()[0]?.id;

  if (!engineId || !getServerEngineById(engineId)) {
    return NextResponse.json(
      { error: "Engine not allowlisted on this server." },
      { status: 403 },
    );
  }

  const rt = jar.get(refreshTokenCookieName(engineId))?.value;
  if (!rt) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const lifetime = lifetimeFromMarker(
    jar.get(persistMarkerCookieName(engineId))?.value,
  );

  try {
    const pair = await elsaRefresh(engineId, rt);
    const session = decodeAccessToken(pair.accessToken);
    const res = NextResponse.json({
      accessToken: pair.accessToken,
      expiresAt: session.expiresAt ?? null,
      engineId,
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
    res.cookies.set(
      persistMarkerCookieName(engineId),
      lifetime === "persistent" ? "1" : "0",
      persistMarkerCookieOptions(lifetime),
    );
    return res;
  } catch (err) {
    const status = err instanceof ElsaAuthError ? err.status : 502;
    const res = NextResponse.json(
      { error: "Refresh failed" },
      { status: status === 502 ? 502 : 401 },
    );
    res.cookies.delete(accessTokenCookieName(engineId));
    res.cookies.delete(refreshTokenCookieName(engineId));
    return res;
  }
}
