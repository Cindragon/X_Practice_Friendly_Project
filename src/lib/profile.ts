import { prisma } from "@/lib/db";
import { connectMongo } from "@/lib/mongo";
import { Post } from "@/models/Post";

/**
 * Shared profile loader used by both /profile (self) and /u/[userID]
 * (others). Performs the cross-DB join: relational profile fields come
 * from Postgres via Prisma, while `postsCount` is computed from the
 * MongoDB Post collection. The optional `viewerId` lets server components
 * compute viewer-relative flags (isMe / isFollowing) without a second
 * round-trip.
 */
export type ProfileView = {
  id: string;
  userID: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdAt: Date;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isMe: boolean;
  isFollowing: boolean;
};

export async function loadProfileByUserID(
  userID: string,
  viewerId?: string | null
): Promise<ProfileView | null> {
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
  if (!user || !user.userID) return null;

  await connectMongo();
  const postsCount = await Post.countDocuments({
    authorId: user.id,
    deletedAt: null,
  });

  let isMe = false;
  let isFollowing = false;
  if (viewerId) {
    isMe = viewerId === user.id;
    if (!isMe) {
      const row = await prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: user.id,
          },
        },
      });
      isFollowing = !!row;
    }
  }

  return {
    id: user.id,
    userID: user.userID,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl ?? user.image ?? null,
    bannerUrl: user.bannerUrl,
    createdAt: user.createdAt,
    followersCount: user._count.followers,
    followingCount: user._count.followings,
    postsCount,
    isMe,
    isFollowing,
  };
}
