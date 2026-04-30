import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { connectMongo } from "@/lib/mongo";
import { Post } from "@/models/Post";
import { notFound, ok } from "@/lib/api";

type Ctx = { params: Promise<{ userID: string }> };

/**
 * GET /api/users/[userID]
 *
 * Public profile by userID handle. Available to anyone; an authenticated
 * caller additionally gets `isFollowing` and `isMe` flags so the UI can
 * decide between Follow / Following / Edit Profile buttons.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { userID } = await ctx.params;
  const session = await auth();

  const user = await prisma.user.findUnique({
    where: { userID },
    select: {
      id: true,
      userID: true,
      name: true,
      image: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      createdAt: true,
      _count: { select: { followers: true, followings: true } },
    },
  });
  if (!user || !user.userID) return notFound("User not found");

  await connectMongo();
  const postsCount = await Post.countDocuments({
    authorId: user.id,
    deletedAt: null,
  });

  let isFollowing = false;
  let isMe = false;
  if (session?.user) {
    isMe = session.user.id === user.id;
    if (!isMe) {
      const row = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: session.user.id,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!row;
    }
  }

  return ok({
    id: user.id,
    userID: user.userID,
    name: user.name,
    avatarUrl: user.avatarUrl ?? user.image ?? null,
    bannerUrl: user.bannerUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    followersCount: user._count.followers,
    followingCount: user._count.followings,
    postsCount,
    isMe,
    isFollowing,
  });
}
