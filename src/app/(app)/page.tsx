import { requireUser } from "@/lib/session";
import { loadHomeFeed, type FeedMode } from "@/lib/feed";
import { HomeTabs } from "@/components/timeline/HomeTabs";
import { TimelineList } from "@/components/timeline/TimelineList";

type SearchParams = Promise<{ tab?: string; cursor?: string }>;

/**
 * / — Home timeline.
 *
 * Reads ?tab=all|following and ?cursor=<objectId> from the URL so
 * pagination state and tab choice survive reload + share + back-button.
 * The actual data loading is in src/lib/feed.ts so the same code path
 * powers /api/feed (for any future infinite-scroll UI).
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const mode: FeedMode = sp.tab === "following" ? "following" : "all";
  const cursor = sp.cursor ?? null;

  const page = await loadHomeFeed({
    mode,
    viewerId: user.id,
    cursor,
  });

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">Home</h1>
      </header>

      <HomeTabs active={mode} />
      <TimelineList page={page} mode={mode} />
    </>
  );
}
