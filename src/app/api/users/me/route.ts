import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { connectMongo } from "@/lib/mongo";
import { Post } from "@/models/Post";
import {
  badRequest,
  fromZodError,
  notFound,
  ok,
  parseJson,
  unauthorized,
} from "@/lib/api";
import { updateMeSchema } from "@/lib/schemas";

/**
 * GET /api/users/me
 *
 * Full profile of the signed-in user, including aggregate counts.
 * Post count comes from MongoDB (cross-DB join in app layer).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      userID: true,
      name: true,
      email: true,
      image: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      createdAt: true,
      _count: { select: { followers: true, followings: true } },
    },
  });
  if (!user) return notFound("User not found");

  await connectMongo();
  const postsCount = await Post.countDocuments({
    authorId: user.id,
    deletedAt: null,
  });

  return ok({
    id: user.id,
    userID: user.userID,
    name: user.name,
    email: user.email,
    image: user.image,
    avatarUrl: user.avatarUrl ?? user.image ?? null,
    bannerUrl: user.bannerUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    followersCount: user._count.followers,
    followingCount: user._count.followings,
    postsCount,
  });
}

/**
 * PATCH /api/users/me
 *
 * Partial update of editable profile fields.
 * `userID` is intentionally NOT editable here — see /setup-username.
 */
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user) return unauthorized();

  const parsed = await parseJson(req);
  if (!parsed.ok) return parsed.response;

  const result = updateMeSchema.safeParse(parsed.body);
  if (!result.success) return fromZodError(result.error);

  // Strict schema already drops unknown keys; normalize empty strings → null.
  const data = Object.fromEntries(
    Object.entries(result.data).map(([k, v]) => [k, v === "" ? null : v])
  );

  if (Object.keys(data).length === 0) {
    return badRequest("Provide at least one field to update");
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      userID: true,
      name: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
    },
  });
  return ok(updated);
}
