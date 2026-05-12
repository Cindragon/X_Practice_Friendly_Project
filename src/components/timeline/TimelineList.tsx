import Link from "next/link";
import { PostCard } from "@/components/post/PostCard";
import type { FeedPage, FeedMode } from "@/lib/feed";

/**
 * Renders a single page of the timeline, plus a "Load more" link if the
 * loader returned a next cursor. "Load more" is a plain Link to keep
 * pagination server-rendered for now; infinite scroll would replace this.
 */
export function TimelineList({
  page,
  mode,
}: {
  page: FeedPage;
  mode: FeedMode;
}) {
  if (page.items.length === 0) {
    return (
      <EmptyState mode={mode} />
    );
  }

  return (
    <>
      <ol>
        {page.items.map((item) => (
          <li key={item.id}>
            <PostCard item={item} />
          </li>
        ))}
      </ol>

      {page.nextCursor && (
        <div className="p-4 text-center">
          <Link
            href={`/?tab=${mode}&cursor=${page.nextCursor}`}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            Load more
          </Link>
        </div>
      )}
    </>
  );
}

function EmptyState({ mode }: { mode: FeedMode }) {
  return (
    <div className="p-10 text-center text-sm text-zinc-500">
      {mode === "following"
        ? "Posts from people you follow will show up here. Follow someone to get started."
        : "It's quiet here. Be the first to post something."}
    </div>
  );
}
