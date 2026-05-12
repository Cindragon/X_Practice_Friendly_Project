import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import { Avatar } from "@/components/profile/Avatar";
import { PostBody } from "./PostBody";
import type { FeedItem } from "@/lib/feed";

/**
 * One row in the timeline / thread.
 *
 * Server component — pure render. The like / reply / repost buttons here
 * are visual only; wiring them lands in Step 9 (post detail page) and
 * Step 10 (Pusher realtime).
 *
 * A repost row renders the ORIGINAL post inside but with a small
 * "@whoever reposted" banner above so the timeline doesn't visually
 * fork into two card styles.
 */
export function PostCard({ item }: { item: FeedItem }) {
  // Repost shortcut: present the original card with a banner above.
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
        <PostCardBody item={item.repostOf} />
      </article>
    );
  }

  return (
    <article className="border-b border-zinc-200 px-4 py-3 hover:bg-zinc-50/40">
      <PostCardBody item={item} />
    </article>
  );
}

function PostCardBody({ item }: { item: FeedItem }) {
  const author = item.author;
  const displayName = author?.name ?? author?.userID ?? "Unknown";
  const handle = author?.userID ?? "unknown";

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

        <ActionBar item={item} />
      </div>
    </div>
  );
}

function ActionBar({ item }: { item: FeedItem }) {
  return (
    <div className="mt-2 flex max-w-md items-center justify-between text-zinc-500">
      <Action
        Icon={MessageCircle}
        count={item.counts.replies}
        label="Reply"
        hoverColor="hover:text-sky-600"
      />
      <Action
        Icon={Repeat2}
        count={item.counts.reposts}
        label="Repost"
        hoverColor="hover:text-emerald-600"
      />
      <Action
        Icon={Heart}
        count={item.counts.likes}
        label="Like"
        hoverColor="hover:text-red-600"
        active={item.likedByMe}
        activeColor="text-red-600"
      />
      <Action
        Icon={Share}
        count={0}
        label="Share"
        hoverColor="hover:text-sky-600"
        countHidden
      />
    </div>
  );
}

function Action({
  Icon,
  count,
  label,
  hoverColor,
  active,
  activeColor,
  countHidden,
}: {
  Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  count: number;
  label: string;
  hoverColor: string;
  active?: boolean;
  activeColor?: string;
  countHidden?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 text-sm ${
        active ? activeColor : ""
      } ${hoverColor}`}
      aria-label={label}
      role="img"
    >
      <Icon className="h-4 w-4" aria-hidden />
      {!countHidden && <span className="tabular-nums">{count || ""}</span>}
    </div>
  );
}
