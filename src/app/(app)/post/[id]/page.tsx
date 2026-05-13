import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { loadPostById, loadReplies } from "@/lib/feed";
import { FocusedPost } from "@/components/post/FocusedPost";
import { PostCard } from "@/components/post/PostCard";
import { ReplyComposerInline } from "@/components/composer/ReplyComposerInline";
import { PostRealtime } from "@/components/realtime/PostRealtime";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

/**
 * /post/[id] — single-post detail page.
 *
 * Layout:
 *   [ ← back · "Post" header ]
 *   [ FocusedPost (large, with action bar)              ]
 *   [ inline reply composer                             ]
 *   [ direct replies (each clickable → /post/<reply>)   ]
 *
 * Recursive viewing falls out for free: clicking any reply navigates
 * to that reply's own /post/[id] page, where it becomes the focused
 * post and its own children show below. No tree expansion in-place,
 * matching the spec's "route changes when clicking" rule.
 */
export default async function PostDetailPage({
  params,
  searchParams,
}: Params) {
  const { id } = await params;
  const { cursor } = await searchParams;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const post = await loadPostById(id, viewerId);
  if (!post) notFound();

  const replies = await loadReplies(id, viewerId, {
    limit: 30,
    cursor: cursor ?? null,
  });

  return (
    <>
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
        <Link
          href="/"
          aria-label="Back"
          className="rounded-full p-1 text-zinc-700 hover:bg-zinc-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Post</h1>
      </header>

      <PostRealtime postId={post.id} viewerId={viewerId} />

      <FocusedPost post={post} viewerId={viewerId} />

      {viewerId && !post.deleted && (
        <ReplyComposerInline
          parentId={post.id}
          parentAuthorHandle={post.author?.userID ?? null}
        />
      )}

      {replies.items.length === 0 ? (
        <div className="p-10 text-center text-sm text-zinc-500">
          No replies yet.
        </div>
      ) : (
        <>
          <ol>
            {replies.items.map((r) => (
              <li key={r.id}>
                <PostCard item={r} viewerId={viewerId} />
              </li>
            ))}
          </ol>
          {replies.nextCursor && (
            <div className="p-4 text-center">
              <Link
                href={`/post/${post.id}?cursor=${replies.nextCursor}`}
                className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
              >
                Load more replies
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );
}
