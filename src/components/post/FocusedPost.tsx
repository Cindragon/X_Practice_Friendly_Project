import Link from "next/link";
import { format } from "date-fns";
import { Avatar } from "@/components/profile/Avatar";
import { PostBody } from "./PostBody";
import { PostActions } from "./PostActions";
import type { FocusedPostView } from "@/lib/feed";

/**
 * The "headline" post on /post/[id]. Bigger than a timeline card —
 * larger avatar, larger body text, absolute timestamp instead of
 * relative — to mark it as the page's subject.
 *
 * If the focused post is itself a reply, we show a "Replying to @x"
 * link above so the viewer can walk up the thread.
 */
export function FocusedPost({
  post,
  viewerId,
}: {
  post: FocusedPostView;
  viewerId: string | null;
}) {
  const author = post.author;
  const isAuthor = !!viewerId && !!author && author.id === viewerId;

  return (
    <article className="border-b border-zinc-200 px-4 py-4">
      {post.parent && (
        <p className="mb-2 text-sm text-zinc-500">
          Replying to{" "}
          {post.parent.authorHandle ? (
            <Link
              href={`/u/${post.parent.authorHandle}`}
              className="text-sky-600 hover:underline"
            >
              @{post.parent.authorHandle}
            </Link>
          ) : (
            <span className="italic">[deleted user]</span>
          )}{" "}
          ·{" "}
          <Link
            href={`/post/${post.parent.id}`}
            className="hover:underline"
          >
            view parent
          </Link>
        </p>
      )}

      <header className="flex items-start gap-3">
        {author ? (
          <Link href={`/u/${author.userID}`}>
            <Avatar src={author.avatarUrl} name={author.name} size={56} />
          </Link>
        ) : (
          <Avatar src={null} name="?" size={56} />
        )}
        <div className="min-w-0 flex-1">
          {author ? (
            <>
              <Link
                href={`/u/${author.userID}`}
                className="block truncate font-bold text-zinc-900 hover:underline"
              >
                {author.name ?? author.userID}
              </Link>
              <Link
                href={`/u/${author.userID}`}
                className="block truncate text-sm text-zinc-500 hover:underline"
              >
                @{author.userID}
              </Link>
            </>
          ) : (
            <span className="block text-sm text-zinc-500">
              [deleted user]
            </span>
          )}
        </div>
      </header>

      <div className="mt-3 text-lg leading-snug">
        <PostBody content={post.content} deleted={post.deleted} />
      </div>

      <p className="mt-3 text-sm text-zinc-500">
        {format(new Date(post.createdAt), "h:mm a · MMM d, yyyy")}
      </p>

      <PostActions
        item={post}
        viewerIsAuthor={isAuthor}
        viewerIsSignedIn={!!viewerId}
        size="md"
      />
    </article>
  );
}
