import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  COOKIES,
  accessTokenCookieName,
  persistMarkerCookieName,
  refreshTokenCookieName,
} from "@/lib/config";
import { listServerEngines } from "@/lib/engines/server-registry";

/**
 * Logout. By default clears tokens for the active engine only. Pass
 * `?engineId=…` to log out of a specific engine, or `?all=1` to clear
 * every engine's cookies in one shot.
 */
export async function POST(req: NextRequest) {
  const jar = await cookies();
  const all = req.nextUrl.searchParams.get("all") === "1";
  const requested = req.nextUrl.searchParams.get("engineId");
  const res = NextResponse.json({ ok: true });

  if (all) {
    for (const e of listServerEngines()) {
      res.cookies.delete(accessTokenCookieName(e.id));
      res.cookies.delete(refreshTokenCookieName(e.id));
      res.cookies.delete(persistMarkerCookieName(e.id));
    }
    res.cookies.delete(COOKIES.activeEngine);
    // Legacy single-engine cookies — clear too in case of an upgrade.
    res.cookies.delete(COOKIES.accessToken);
    res.cookies.delete(COOKIES.refreshToken);
    return res;
  }

  const engineId =
    requested ??
    jar.get(COOKIES.activeEngine)?.value ??
    listServerEngines()[0]?.id;
  if (engineId) {
    res.cookies.delete(accessTokenCookieName(engineId));
    res.cookies.delete(refreshTokenCookieName(engineId));
    res.cookies.delete(persistMarkerCookieName(engineId));
  }
  // Legacy single-engine cookies — clear unconditionally so we don't leave
  // stale state from a pre-multi-engine deployment behind.
  res.cookies.delete(COOKIES.accessToken);
  res.cookies.delete(COOKIES.refreshToken);
  return res;
}
