import { NextResponse } from "next/server";
import { z } from "zod";

import {
  COOKIES,
  accessTokenCookieName,
  persistMarkerCookieName,
  refreshTokenCookieName,
} from "@/lib/config";
import {
  ElsaAuthError,
  activeEngineCookieOptions,
  elsaLogin,
  persistMarkerCookieOptions,
  refreshCookieOptions,
  tokenCookieOptions,
} from "@/lib/auth/server";
import { getServerEngineById, listServerEngines } from "@/lib/engines/server-registry";
import { decodeAccessToken, displayName } from "@/lib/auth/session";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  engineId: z.string().min(1).optional(),
  rememberMe: z.boolean().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "username and password are required" },
      { status: 400 },
    );
  }

  const engineId = parsed.data.engineId ?? listServerEngines()[0].id;
  if (!getServerEngineById(engineId)) {
    return NextResponse.json(
      { error: "Engine not allowlisted on this server." },
      { status: 403 },
    );
  }

  // Default to true so the previous behaviour (persistent 30-day session)
  // is preserved when older clients omit the flag.
  const rememberMe = parsed.data.rememberMe ?? true;
  const lifetime = rememberMe ? "persistent" : "session";

  try {
    const pair = await elsaLogin(
      engineId,
      parsed.data.username,
      parsed.data.password,
    );
    const session = decodeAccessToken(pair.accessToken);
    const res = NextResponse.json({
      user: {
        name: displayName(session.claims),
        email: session.claims.email ?? null,
      },
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
      rememberMe ? "1" : "0",
      persistMarkerCookieOptions(lifetime),
    );
    res.cookies.set(COOKIES.activeEngine, engineId, activeEngineCookieOptions());
    return res;
  } catch (err) {
    if (err instanceof ElsaAuthError) {
      // 401 = bad credentials; 0 = couldn't reach Elsa; everything else = upstream error.
      const status = err.status === 401 ? 401 : err.status === 0 ? 502 : 502;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[auth] login route unexpected error:", err);
    return NextResponse.json({ error: "Login failed (unexpected)" }, { status: 500 });
  }
}
