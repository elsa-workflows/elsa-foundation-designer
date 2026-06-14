import { NextResponse, type NextRequest } from "next/server";

import { COOKIES, accessTokenCookieName } from "@/lib/config";
import {
  MODULES_COOKIE,
  MODULE_ROUTE_MANIFEST,
  isPathOwnedByModule,
  parseEnabledCookie,
} from "@/lib/modules/route-manifest";

const PUBLIC_PATHS = new Set(["/login"]);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Allow public paths, API routes and Next internals through.
  if (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/dev/")
  ) {
    return NextResponse.next();
  }

  // Multi-engine session: we look for an access-token cookie scoped to the
  // currently-active engine. If `elsa_active_engine` is set, check that
  // engine's cookie; otherwise fall back to checking *any* engine cookie
  // (covers the first-load case before the client has written
  // elsa_active_engine).
  const activeEngine = req.cookies.get(COOKIES.activeEngine)?.value;
  let hasSession = false;
  if (activeEngine) {
    hasSession = req.cookies.has(accessTokenCookieName(activeEngine));
  } else {
    hasSession = req.cookies
      .getAll()
      .some((c) => c.name.startsWith("elsa_at_")) ||
      // Legacy single-engine cookie — kept so existing sessions survive an
      // upgrade. Cleared on next logout.
      req.cookies.has(COOKIES.accessToken);
  }

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  // Module gate: if the path belongs to a disabled module, send the user
  // to the dashboard. Required modules are exempt — their entries always
  // resolve as enabled even when the cookie is malformed.
  const enabledIds = new Set(parseEnabledCookie(req.cookies.get(MODULES_COOKIE)?.value));
  const blocking = MODULE_ROUTE_MANIFEST.find(
    (entry) =>
      !entry.required &&
      !enabledIds.has(entry.id) &&
      isPathOwnedByModule(pathname, entry),
  );
  if (blocking) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on everything except static assets and favicon.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|gif|webp|ico)$).*)"],
};
