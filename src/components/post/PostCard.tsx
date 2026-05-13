import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Repeat2 } from "lucide-react";
import { Avatar } from "@/components/profile/Avatar";
import { PostBody } from "./PostBody";
import { PostActions } from "./PostActions";
import type { FeedItem } from "@/lib/feed";

/**
 * One row in the timeline / thread.
 *
 * Server component. Interactive bits (like / repost / reply / delete)
 * are inside the PostActions child, which is the client boundary.
 *
 * A repost row renders the ORIGINAL post inside but with a small
 * "@whoever reposted" banner above so the timeline doesn't visually
 * fork into two card styles.
 */
export function PostCard({
  item,
  viewerId,
}: {
  item: FeedItem;
  viewerId: string | null;
}) {
  if (item.repostOf) {
    return (
      <article className="border-b border-zinc-200 px-4 py-3 hover:bg-zinc-50/40">
        <div className="mb-2 flex items-center gap-2 pl-12 text-xs text-zinc-500">
          <Repeat2 className="h-3.5 w-3.5" aria-hidden />
          <span>
            {item.author ? (
              <Link
                href={`/u/${item.author.userID}`}
                className="hover:underline"
              >
                @{item.author.userID}
              </Link>
            ) : (
              "Someone"
            )}{" "}
            reposted
          </span>
        </div>
        <PostCardBody item={item.repostOf} viewerId={viewerId} />
      </article>
    );
  }

  return (
    <article className="border-b border-zinc-200 px-4 py-3 hover:bg-zinc-50/40">
      <PostCardBody item={item} viewerId={viewerId} />
    </article>
  );
}

function PostCardBody({
  item,
  viewerId,
}: {
  item: FeedItem;
  viewerId: string | null;
}) {
  const author = item.author;
  const displayName = author?.name ?? author?.userID ?? "Unknown";
  const handle = author?.userID ?? "unknown";
  const isAuthor = !!viewerId && !!author && author.id === viewerId;

  return (
    <div className="flex gap-3">
      <div className="shrink-0">
        {author ? (
          <Link href={`/u/${author.userID}`} aria-label={`Open @${handle}`}>
            <Avatar src={author.avatarUrl} name={displayName} size={48} />
          </Link>
        ) : (
          <Avatar src={null} name="?" size={48} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-1.5 text-sm">
          {author ? (
            <Link
              href={`/u/${author.userID}`}
              className="truncate font-semibold text-zinc-900 hover:underline"
            >
              {displayName}
            </Link>
          ) : (
            <span className="truncate text-zinc-500">[deleted user]</span>
          )}
          <span className="truncate text-zinc-500">@{handle}</span>
          <span className="text-zinc-500">·</span>
          <Link
            href={`/post/${item.id}`}
            className="text-zinc-500 hover:underline"
            title={new Date(item.createdAt).toLocaleString()}
          >
            {formatDistanceToNowStrict(new Date(item.createdAt), {
              addSuffix: false,
            })}
          </Link>
        </header>

        <Link href={`/post/${item.id}`} className="mt-1 block">
          <PostBody content={item.content} deleted={item.deleted} />
        </Link>

        <PostActions
          item={item}
          viewerIsAuthor={isAuthor}
          viewerIsSignedIn={!!viewerId}
          size="sm"
        />
      </div>
    </div>
  );
}
