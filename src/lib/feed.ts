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
