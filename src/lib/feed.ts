import mongoose from "mongoose";
import { prisma } from "@/lib/db";
import { connectMongo } from "@/lib/mongo";
import { Post, type PostDoc } from "@/models/Post";

/**
 * Home feed loader.
 *
 * Used by:
 *   - the / page (server render) → ServerComponent calls loadHomeFeed()
 *   - GET /api/feed                → JSON for any future infinite-scroll UI
 *
 * Pagination is cursor-based on the `_id` field: every Mongo ObjectId
 * encodes the creation time in its first 4 bytes, so sorting by `_id`
 * desc is equivalent to sorting by createdAt desc but with a stable
 * tiebreaker. The cursor is the last `_id` of the previous page; pass
 * `{ $lt: cursor }` to skip already-seen rows.
 *
 * Cross-DB join: posts live in Mongo, authors in Postgres. We batch the
 * author lookup with one `findMany({ id: { in } })` to avoid N+1.
 */

export type FeedMode = "all" | "following";

export type FeedAuthor = {
  id: string;
  userID: string;
  name: string | null;
  avatarUrl: string | null;
};

export type FeedItem = {
  id: string;
  content: string;
  deleted: boolean;
  parentId: string | null;
  repostOfId: string | null;
  createdAt: Date;
  author: FeedAuthor | null;
  /** When this row is itself a repost, the original post hydrated. */
  repostOf: FeedItem | null;
  counts: {
    replies: number;
    reposts: number;
    likes: number;
  };
  likedByMe: boolean;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
};

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function loadHomeFeed(opts: {
  mode: FeedMode;
  viewerId?: string | null;
  cursor?: string | null;
  limit?: number;
}): Promise<FeedPage> {
  const { mode, viewerId } = opts;
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
  const cursor =
    opts.cursor && OBJECT_ID_RE.test(opts.cursor) ? opts.cursor : null;

  await connectMongo();

  // ── Author scope: which authorIds are we showing? ─────────────────────
  let authorScope: { authorId?: { $in: string[] } } = {};
  if (mode === "following") {
    if (!viewerId) return { items: [], nextCursor: null };
    const follows = await prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followingId: true },
    });
    const ids = follows.map((f) => f.followingId);
    // Per spec, "Following" feed shows posts from people I follow PLUS my
    // own — easier to see "your post landed".
    ids.push(viewerId);
    if (ids.length === 0) return { items: [], nextCursor: null };
    authorScope = { authorId: { $in: ids } };
  }

  // ── Mongo query ───────────────────────────────────────────────────────
  const query: Record<string, unknown> = {
    ...authorScope,
    deletedAt: null,
    parentId: null, // home feed shows top-level posts + reposts only
  };
  if (cursor) {
    query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
  }

  // Fetch limit+1 to know if there's a next page.
  const raw = await Post.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean<PostDoc[]>();

  const hasMore = raw.length > limit;
  const slice = hasMore ? raw.slice(0, limit) : raw;
  const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;

  // ── Hydrate authors (batched) ─────────────────────────────────────────
  // For reposts, we also need the original post + its author.
  const repostTargetIds: string[] = [];
  for (const p of slice) {
    if (p.repostOfId) repostTargetIds.push(String(p.repostOfId));
  }
  const repostTargets = repostTargetIds.length
    ? await Post.find({ _id: { $in: repostTargetIds } }).lean<PostDoc[]>()
    : [];
  const targetById = new Map<string, PostDoc>(
    repostTargets.map((d) => [String(d._id), d])
  );

  const allAuthorIds = new Set<string>();
  for (const p of slice) {
    allAuthorIds.add(p.authorId);
    if (p.repostOfId) {
      const t = targetById.get(String(p.repostOfId));
      if (t) allAuthorIds.add(t.authorId);
    }
  }

  const authors = allAuthorIds.size
    ? await prisma.user.findMany({
        where: { id: { in: Array.from(allAuthorIds) } },
        select: {
          id: true,
          userID: true,
          name: true,
          image: true,
          avatarUrl: true,
        },
      })
    : [];
  const authorById = new Map<string, FeedAuthor>(
    authors
      .filter((a) => !!a.userID)
      .map((a) => [
        a.id,
        {
          id: a.id,
          userID: a.userID as string,
          name: a.name,
          avatarUrl: a.avatarUrl ?? a.image ?? null,
        },
      ])
  );

  // ── Counts: replies / reposts / likes — batched per id ───────────────
  // (Two-phase counts: one $match per metric. For the post-card volumes
  //  we expect here, two aggregations + one SQL count are fine; we can
  //  switch to denormalised counters if/when this gets hot.)
  const postIds = slice.map((p) => String(p._id));
  const targetIds = Array.from(targetById.keys());
  const allIdsForCounts = Array.from(new Set([...postIds, ...targetIds]));

  const [replyAgg, repostAgg, likeRows] = await Promise.all([
    allIdsForCounts.length
      ? Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          {
            $match: {
              parentId: {
                $in: allIdsForCounts.map(
                  (i) => new mongoose.Types.ObjectId(i)
                ),
              },
              deletedAt: null,
            },
          },
          { $group: { _id: "$parentId", n: { $sum: 1 } } },
        ])
      : [],
    allIdsForCounts.length
      ? Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          {
            $match: {
              repostOfId: {
                $in: allIdsForCounts.map(
                  (i) => new mongoose.Types.ObjectId(i)
                ),
              },
              deletedAt: null,
            },
          },
          { $group: { _id: "$repostOfId", n: { $sum: 1 } } },
        ])
      : [],
    allIdsForCounts.length
      ? prisma.like.groupBy({
          by: ["postId"],
          where: { postId: { in: allIdsForCounts } },
          _count: { _all: true },
        })
      : [],
  ]);

  const repliesByPost = new Map<string, number>(
    replyAgg.map((r) => [String(r._id), r.n])
  );
  const repostsByPost = new Map<string, number>(
    repostAgg.map((r) => [String(r._id), r.n])
  );
  const likesByPost = new Map<string, number>(
    likeRows.map((r) => [r.postId, r._count._all])
  );

  // ── My likes (only for the visible ids) ───────────────────────────────
  let likedByMe = new Set<string>();
  if (viewerId && allIdsForCounts.length) {
    const myLikes = await prisma.like.findMany({
      where: { userId: viewerId, postId: { in: allIdsForCounts } },
      select: { postId: true },
    });
    likedByMe = new Set(myLikes.map((l) => l.postId));
  }

  // ── Shape ─────────────────────────────────────────────────────────────
  function shape(p: PostDoc): FeedItem {
    const id = String(p._id);
    const target =
      p.repostOfId ? targetById.get(String(p.repostOfId)) ?? null : null;
    return {
      id,
      content: p.deletedAt ? "" : p.content,
      deleted: !!p.deletedAt,
      parentId: p.parentId ? String(p.parentId) : null,
      repostOfId: p.repostOfId ? String(p.repostOfId) : null,
      createdAt: p.createdAt,
      author: authorById.get(p.authorId) ?? null,
      repostOf: target ? shape(target) : null,
      counts: {
        replies: repliesByPost.get(id) ?? 0,
        reposts: repostsByPost.get(id) ?? 0,
        likes: likesByPost.get(id) ?? 0,
      },
      likedByMe: likedByMe.has(id),
    };
  }

  return {
    items: slice.map(shape),
    nextCursor,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-post + replies loaders for /post/[id].
// ─────────────────────────────────────────────────────────────────────────────

export type FocusedPostView = FeedItem & {
  /** Snippet of the parent so /post/[id] can show "Replying to @x". */
  parent: {
    id: string;
    authorHandle: string | null;
  } | null;
};

/** Helper: shape a single PostDoc with all the same hydration as the feed. */
async function shapeOne(
  post: PostDoc,
  viewerId: string | null | undefined
): Promise<FeedItem> {
  const id = String(post._id);

  // Author + (if repost) original post + original author.
  const target = post.repostOfId
    ? await Post.findById(post.repostOfId).lean<PostDoc | null>()
    : null;

  const authorIds = new Set<string>([post.authorId]);
  if (target) authorIds.add(target.authorId);

  const authors = await prisma.user.findMany({
    where: { id: { in: Array.from(authorIds) } },
    select: {
      id: true,
      userID: true,
      name: true,
      image: true,
      avatarUrl: true,
    },
  });
  const authorById = new Map<string, FeedAuthor>(
    authors
      .filter((a) => !!a.userID)
      .map((a) => [
        a.id,
        {
          id: a.id,
          userID: a.userID as string,
          name: a.name,
          avatarUrl: a.avatarUrl ?? a.image ?? null,
        },
      ])
  );

  const ids = target ? [id, String(target._id)] : [id];
  const [repliesArr, repostsArr, likes] = await Promise.all([
    Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      {
        $match: {
          parentId: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) },
          deletedAt: null,
        },
      },
      { $group: { _id: "$parentId", n: { $sum: 1 } } },
    ]),
    Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
      {
        $match: {
          repostOfId: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) },
          deletedAt: null,
        },
      },
      { $group: { _id: "$repostOfId", n: { $sum: 1 } } },
    ]),
    prisma.like.groupBy({
      by: ["postId"],
      where: { postId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const repliesBy = new Map(repliesArr.map((r) => [String(r._id), r.n]));
  const repostsBy = new Map(repostsArr.map((r) => [String(r._id), r.n]));
  const likesBy = new Map(likes.map((r) => [r.postId, r._count._all]));

  let likedSet = new Set<string>();
  if (viewerId) {
    const rows = await prisma.like.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true },
    });
    likedSet = new Set(rows.map((r) => r.postId));
  }

  function shapeInner(p: PostDoc): FeedItem {
    const pid = String(p._id);
    return {
      id: pid,
      content: p.deletedAt ? "" : p.content,
      deleted: !!p.deletedAt,
      parentId: p.parentId ? String(p.parentId) : null,
      repostOfId: p.repostOfId ? String(p.repostOfId) : null,
      createdAt: p.createdAt,
      author: authorById.get(p.authorId) ?? null,
      repostOf: null, // filled below for the outer item
      counts: {
        replies: repliesBy.get(pid) ?? 0,
        reposts: repostsBy.get(pid) ?? 0,
        likes: likesBy.get(pid) ?? 0,
      },
      likedByMe: likedSet.has(pid),
    };
  }

  const item = shapeInner(post);
  if (target) item.repostOf = shapeInner(target);
  return item;
}

/**
 * GET-shape loader for /post/[id]. Returns the focused post (with all
 * its counts), plus a small snippet of its parent so the page can render
 * "Replying to @parentAuthor".
 *
 * Returns null when the id is unknown. A *soft-deleted* post still
 * resolves — we want to render the deleted placeholder so the rest of
 * the thread isn't orphaned.
 */
export async function loadPostById(
  id: string,
  viewerId: string | null | undefined
): Promise<FocusedPostView | null> {
  if (!OBJECT_ID_RE.test(id)) return null;
  await connectMongo();
  const post = await Post.findById(id).lean<PostDoc | null>();
  if (!post) return null;

  const base = await shapeOne(post, viewerId);

  let parent: FocusedPostView["parent"] = null;
  if (post.parentId) {
    const p = await Post.findById(post.parentId)
      .select({ authorId: 1 })
      .lean<{ authorId: string } | null>();
    if (p) {
      const pa = await prisma.user.findUnique({
        where: { id: p.authorId },
        select: { userID: true },
      });
      parent = {
        id: String(post.parentId),
        authorHandle: pa?.userID ?? null,
      };
    } else {
      parent = { id: String(post.parentId), authorHandle: null };
    }
  }

  return { ...base, parent };
}

/**
 * Direct children of a post (one level deep). Sorted oldest → newest so
 * threads read top-down, matching how Twitter / Threads display replies.
 * Cursor pagination uses the same `_id`-based scheme, but ascending.
 */
export async function loadReplies(
  parentId: string,
  viewerId: string | null | undefined,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<FeedPage> {
  if (!OBJECT_ID_RE.test(parentId)) {
    return { items: [], nextCursor: null };
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? DEFAULT_LIMIT));
  const cursor =
    opts.cursor && OBJECT_ID_RE.test(opts.cursor) ? opts.cursor : null;

  await connectMongo();
  const query: Record<string, unknown> = {
    parentId: new mongoose.Types.ObjectId(parentId),
    deletedAt: null,
  };
  if (cursor) {
    // ASC pagination: cursor is the last seen _id, fetch _id > cursor.
    query._id = { $gt: new mongoose.Types.ObjectId(cursor) };
  }

  const raw = await Post.find(query)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean<PostDoc[]>();

  const hasMore = raw.length > limit;
  const slice = hasMore ? raw.slice(0, limit) : raw;
  const nextCursor = hasMore ? String(slice[slice.length - 1]._id) : null;

  // Reuse the per-page batching from the home feed for these replies.
  const authorIds = Array.from(new Set(slice.map((p) => p.authorId)));
  const ids = slice.map((p) => String(p._id));

  const [authors, replyAgg, repostAgg, likeRows] = await Promise.all([
    authorIds.length
      ? prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: {
            id: true,
            userID: true,
            name: true,
            image: true,
            avatarUrl: true,
          },
        })
      : [],
    ids.length
      ? Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          {
            $match: {
              parentId: {
                $in: ids.map((i) => new mongoose.Types.ObjectId(i)),
              },
              deletedAt: null,
            },
          },
          { $group: { _id: "$parentId", n: { $sum: 1 } } },
        ])
      : [],
    ids.length
      ? Post.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          {
            $match: {
              repostOfId: {
                $in: ids.map((i) => new mongoose.Types.ObjectId(i)),
              },
              deletedAt: null,
            },
          },
          { $group: { _id: "$repostOfId", n: { $sum: 1 } } },
        ])
      : [],
    ids.length
      ? prisma.like.groupBy({
          by: ["postId"],
          where: { postId: { in: ids } },
          _count: { _all: true },
        })
      : [],
  ]);

  const authorById = new Map<string, FeedAuthor>(
    authors
      .filter((a) => !!a.userID)
      .map((a) => [
        a.id,
        {
          id: a.id,
          userID: a.userID as string,
          name: a.name,
          avatarUrl: a.avatarUrl ?? a.image ?? null,
        },
      ])
  );
  const repliesBy = new Map(replyAgg.map((r) => [String(r._id), r.n]));
  const repostsBy = new Map(repostAgg.map((r) => [String(r._id), r.n]));
  const likesBy = new Map(likeRows.map((r) => [r.postId, r._count._all]));

  let likedSet = new Set<string>();
  if (viewerId && ids.length) {
    const rows = await prisma.like.findMany({
      where: { userId: viewerId, postId: { in: ids } },
      select: { postId: true },
    });
    likedSet = new Set(rows.map((r) => r.postId));
  }

  return {
    items: slice.map((p) => {
      const pid = String(p._id);
      return {
        id: pid,
        content: p.deletedAt ? "" : p.content,
        deleted: !!p.deletedAt,
        parentId: p.parentId ? String(p.parentId) : null,
        repostOfId: p.repostOfId ? String(p.repostOfId) : null,
        createdAt: p.createdAt,
        author: authorById.get(p.authorId) ?? null,
        repostOf: null,
        counts: {
          replies: repliesBy.get(pid) ?? 0,
          reposts: repostsBy.get(pid) ?? 0,
          likes: likesBy.get(pid) ?? 0,
        },
        likedByMe: likedSet.has(pid),
      };
    }),
    nextCursor,
  };
}
