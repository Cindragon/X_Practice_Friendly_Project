import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-runtime middleware.
 *
 * We use the database session strategy (Session rows in Postgres), which
 * means the `authjs.session-token` cookie is an opaque random token, not
 * a JWE. The edge runtime can't run Prisma, so it can't look the token
 * up — and if we let Auth.js try to decode it as a JWE we get
 * `JWEInvalid: Invalid Compact JWE` after every login.
 *
 * So the middleware does a *soft* check: cookie present → let the request
 * through and let the server component do the real auth (via auth() with
 * the Prisma adapter, in src/lib/session.ts#requireUser). Cookie missing
 * → redirect to /login.
 *
 * Pages: protected by default.
 * /login, /setup-username: always public.
 * /api/*, /_next/*, /favicon*: opt out — APIs return their own JSON 401s,
 *   the others are static plumbing.
 */
const PUBLIC_PATHS = new Set<string>(["/login", "/setup-username"]);
const PUBLIC_PREFIXES = ["/api", "/_next", "/favicon"];

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));
  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  // Run on every route except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
