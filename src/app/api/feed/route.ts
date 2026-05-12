import { auth } from "@/auth";
import { loadHomeFeed, type FeedMode } from "@/lib/feed";
import { badRequest, ok } from "@/lib/api";

/**
 * GET /api/feed?tab=all|following&cursor=<objectId>&limit=20
 *
 * Same data path as the / page, exposed as JSON. Useful for:
 *   - infinite-scroll UI swap-in later
 *   - external clients / tests
 *
 * The "following" tab requires a session — anonymous callers get 400
 * (rather than 401) when they ask for a personalised feed, to match
 * the spec that the home page itself is sign-in gated. /api/feed?tab=all
 * is openly readable.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tabRaw = url.searchParams.get("tab");
  const mode: FeedMode = tabRaw === "following" ? "following" : "all";
  const cursor = url.searchParams.get("cursor");
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
    return badRequest("Invalid limit");
  }

  const session = await auth();
  if (mode === "following" && !session?.user) {
    return badRequest("Sign in required for the Following feed");
  }

  const page = await loadHomeFeed({
    mode,
    viewerId: session?.user?.id ?? null,
    cursor,
    limit,
  });
  return ok(page);
}
