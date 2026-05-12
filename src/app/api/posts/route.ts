import mongoose from "mongoose";
import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { Post } from "@/models/Post";
import {
  badRequest,
  created,
  fromZodError,
  notFound,
  parseJson,
  unauthorized,
} from "@/lib/api";
import { createPostSchema } from "@/lib/schemas";
import {
  MAX_LENGTH,
  effectiveLength,
  extractHashtags,
  extractMentions,
} from "@/lib/post-text";

/**
 * POST /api/posts
 *
 * Create a top-level post, reply, or repost.
 *
 * - Top-level post : { content }                      (1..280 effective)
 * - Reply          : { content, parentId }            (1..280 effective)
 * - Repost         : { repostOfId }                   (content ignored)
 *
 * Effective length follows X rules:
 *   URLs count as 23 each; @mentions and #hashtags count as 0; rest
 *   counted normally. See src/lib/post-text.ts.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;

  const result = createPostSchema.safeParse(parsed.body);
  if (!result.success) return fromZodError(result.error);

  const { content = "", parentId, repostOfId } = result.data;

  await connectMongo();

  // ── Repost branch ───────────────────────────────────────────────────────
  if (repostOfId) {
    const target = await Post.findOne({
      _id: repostOfId,
      deletedAt: null,
    }).lean();
    if (!target) return notFound("Original post not found");

    // Idempotent: if I've already reposted this, return the existing one
    // rather than spamming the timeline with duplicates.
    const existing = await Post.findOne({
      authorId: session.user.id,
      repostOfId,
      deletedAt: null,
    });
    if (existing) {
      return created({ id: String(existing._id), alreadyReposted: true });
    }

    const doc = await Post.create({
      authorId: session.user.id,
      content: "",
      repostOfId,
    });
    return created({ id: String(doc._id), alreadyReposted: false });
  }

  // ── Post / reply branch ─────────────────────────────────────────────────
  const trimmed = content.trim();
  const effLen = effectiveLength(trimmed);
  if (trimmed.length === 0) {
    return badRequest("Post content cannot be empty");
  }
  if (effLen > MAX_LENGTH) {
    return badRequest(`Post is too long (${effLen}/${MAX_LENGTH})`);
  }

  if (parentId) {
    const parent = await Post.findOne({
      _id: parentId,
      deletedAt: null,
    }).lean();
    if (!parent) return notFound("Parent post not found");
  }

  const doc = await Post.create({
    authorId: session.user.id,
    content: trimmed,
    parentId: parentId
      ? new mongoose.Types.ObjectId(parentId)
      : null,
    mentions: extractMentions(trimmed),
    hashtags: extractHashtags(trimmed),
  });

  return created({ id: String(doc._id) });
}
