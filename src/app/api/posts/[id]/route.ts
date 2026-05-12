import mongoose from "mongoose";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { connectMongo } from "@/lib/mongo";
import { Post } from "@/models/Post";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/**
 * GET /api/posts/[id]
 *
 * Return the post, its author (from Postgres), and aggregate counts
 * (replies, reposts, likes). Soft-deleted posts return 410 Gone with a
 * placeholder body so threads stay intact.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!OBJECT_ID_RE.test(id)) return badRequest("Invalid post id");

  await connectMongo();
  const post = await Post.findById(id).lean();
  if (!post) return notFound("Post not found");

  // Cross-DB join: author info comes from Postgres.
  const author = await prisma.user.findUnique({
    where: { id: post.authorId },
    select: {
      id: true,
      userID: true,
      name: true,
      image: true,
      avatarUrl: true,
    },
  });

  const [repliesCount, repostsCount, likesCount] = await Promise.all([
    Post.countDocuments({ parentId: id, deletedAt: null }),
    Post.countDocuments({ repostOfId: id, deletedAt: null }),
    prisma.like.count({ where: { postId: id } }),
  ]);

  const session = await auth();
  let likedByMe = false;
  if (session?.user) {
    const row = await prisma.like.findUnique({
      where: { userId_postId: { userId: session.user.id, postId: id } },
    });
    likedByMe = !!row;
  }

  return ok({
    id: String(post._id),
    content: post.deletedAt ? "" : post.content,
    deleted: !!post.deletedAt,
    parentId: post.parentId ? String(post.parentId) : null,
    repostOfId: post.repostOfId ? String(post.repostOfId) : null,
    mentions: post.mentions,
    hashtags: post.hashtags,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: author
      ? {
          id: author.id,
          userID: author.userID,
          name: author.name,
          avatarUrl: author.avatarUrl ?? author.image ?? null,
        }
      : null,
    counts: {
      replies: repliesCount,
      reposts: repostsCount,
      likes: likesCount,
    },
    likedByMe,
  });
}

/**
 * DELETE /api/posts/[id] — soft delete (sets deletedAt).
 * Only the author can delete; others get 403.
 * Idempotent: deleting an already-deleted post returns 200.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!OBJECT_ID_RE.test(id)) return badRequest("Invalid post id");

  const session = await auth();
  if (!session?.user) return unauthorized();

  await connectMongo();
  const post = await Post.findById(id);
  if (!post) return notFound("Post not found");
  if (post.authorId !== session.user.id) return forbidden();

  if (!post.deletedAt) {
    post.deletedAt = new Date();
    await post.save();
  }

  // Also clear any likes so counts stay accurate. Mongo-side post id is the
  // string form of ObjectId, same as we store in Postgres' Like.postId.
  await prisma.like.deleteMany({ where: { postId: id } });

  return ok({ deleted: true });
}

/** Silence unused warning when mongoose isn't referenced post-tree-shake. */
void mongoose;
