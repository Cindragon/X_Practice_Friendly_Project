import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  badRequest,
  notFound,
  ok,
  unauthorized,
} from "@/lib/api";

type Ctx = { params: Promise<{ userID: string }> };

/**
 * POST /api/users/[userID]/follow — follow the target user.
 *
 * Idempotent: if the relation already exists we return 200 with
 * `{ alreadyFollowing: true }` rather than 409, since most clients want a
 * stable signal that "you now follow this user".
 */
export async function POST(_req: Request, ctx: Ctx) {
  const { userID } = await ctx.params;
  const session = await auth();
  if (!session?.user) return unauthorized();

  const target = await prisma.user.findUnique({
    where: { userID },
    select: { id: true },
  });
  if (!target) return notFound("User not found");
  if (target.id === session.user.id) {
    return badRequest("You cannot follow yourself");
  }

  try {
    await prisma.follow.create({
      data: { followerId: session.user.id, followingId: target.id },
    });
    return ok({ following: true, alreadyFollowing: false });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return ok({ following: true, alreadyFollowing: true });
    }
    throw err;
  }
}

/**
 * DELETE /api/users/[userID]/follow — unfollow.
 *
 * Idempotent: returns 200 even if the relation didn't exist.
 */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { userID } = await ctx.params;
  const session = await auth();
  if (!session?.user) return unauthorized();

  const target = await prisma.user.findUnique({
    where: { userID },
    select: { id: true },
  });
  if (!target) return notFound("User not found");

  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followingId: target.id },
  });
  return ok({ following: false });
}
