import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { connectMongo } from "@/lib/mongo";
import { Post } from "@/models/Post";
import {
  badRequest,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api";
import { triggerSafe } from "@/lib/pusher-server";
import {
  POST_EVENT_LIKE_CHANGED,
  postChannel,
  type PostLikeChangedPayload,
} from "@/lib/realtime-events";

type Ctx = { params: Promise<{ id: string }> };
const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

/**
 * POST /api/posts/[id]/like — like the post.
 *
 * Idempotent: re-liking returns 200 with `{ alreadyLiked: true }` rather
 * than 409, mirroring the follow endpoint's convention.
 *
 * Like rows live in Postgres (so they get composite-PK uniqueness and
 * cascade on user delete); the postId is the Mongo ObjectId string with
 * no cross-DB FK.
 */
export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!OBJECT_ID_RE.test(id)) return badRequest("Invalid post id");

  const session = await auth();
  if (!session?.user) return unauthorized();

  await connectMongo();
  const post = await Post.findOne({ _id: id, deletedAt: null }).lean();
  if (!post) return notFound("Post not found");

  try {
    await prisma.like.create({
      data: { userId: session.user.id, postId: id },
    });
    await triggerSafe(
      postChannel(id),
      POST_EVENT_LIKE_CHANGED,
      {
        postId: id,
        delta: 1,
        byUserId: session.user.id,
      } satisfies PostLikeChangedPayload
    );
    return ok({ liked: true, alreadyLiked: false });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return ok({ liked: true, alreadyLiked: true });
    }
    throw err;
  }
}

/** DELETE /api/posts/[id]/like — unlike (idempotent). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!OBJECT_ID_RE.test(id)) return badRequest("Invalid post id");

  const session = await auth();
  if (!session?.user) return unauthorized();

  const res = await prisma.like.deleteMany({
    where: { userId: session.user.id, postId: id },
  });
  if (res.count > 0) {
    await triggerSafe(
      postChannel(id),
      POST_EVENT_LIKE_CHANGED,
      {
        postId: id,
        delta: -1,
        byUserId: session.user.id,
      } satisfies PostLikeChangedPayload
    );
  }
  return ok({ liked: false });
}
