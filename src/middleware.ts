import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

/**
 * Edge-runtime middleware.
 *
 * Two responsibilities:
 *   1. Redirect anonymous traffic on app routes to /login.
 *   2. Force authenticated users without a userID to /setup-username.
 *
 * We use the lightweight `authConfig` (no Prisma) because middleware can't
 * use Node-only APIs. Whether the userID is set is read from the JWT
 * (populated in src/auth.ts on first session creation) — but with database
 * sessions middleware only sees the session cookie's existence, not the
 * userID. To keep this edge-safe we treat "/setup-username" and "/login" as
 * always-allowed; the setup page itself reads the DB and redirects away if
 * userID is already set.
 *
 * The "userID missing -> /setup-username" enforcement also lives in each
 * server-rendered page (via `auth()` in layout.tsx) for completeness.
 */
const PUBLIC_PATHS = new Set<string>(["/login", "/setup-username"]);
// API routes manage their own auth and respond with JSON 401s — middleware
// only protects rendered pages so unauth'd clients aren't redirected mid-fetch.
const PUBLIC_PREFIXES = ["/api", "/_next", "/favicon"];

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Run on every route except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
