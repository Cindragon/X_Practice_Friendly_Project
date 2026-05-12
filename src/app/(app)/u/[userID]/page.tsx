import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { loadProfileByUserID } from "@/lib/profile";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { FollowButton } from "@/components/profile/FollowButton";
import { EmptyTab } from "@/components/profile/EmptyTab";

type Params = { params: Promise<{ userID: string }> };

/**
 * /u/[userID] — public profile for any user.
 *
 * - If the viewer is the profile owner, redirect to /profile (the
 *   editable view) so we don't end up with two URLs for "my profile".
 * - Anonymous viewers see the page without follow controls.
 * - Authenticated viewers see a Follow / Unfollow toggle.
 *
 * Note: this route does NOT use requireUser() — it must be reachable
 * while logged out (anonymous profile viewing is allowed per spec).
 */
export default async function UserProfilePage({ params }: Params) {
  const { userID } = await params;
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const profile = await loadProfileByUserID(userID, viewerId);
  if (!profile) notFound();

  if (profile.isMe) redirect("/profile");

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">{profile.name ?? profile.userID}</h1>
        <p className="text-sm text-zinc-500">{profile.postsCount} posts</p>
      </header>

      <ProfileHeader
        profile={profile}
        action={
          viewerId ? (
            <FollowButton
              targetUserID={profile.userID}
              initialFollowing={profile.isFollowing}
            />
          ) : null
        }
      />

      <ProfileTabs
        postsSlot={<EmptyTab message="No posts yet." />}
        likesSlot={<EmptyTab message="No likes yet." />}
      />
    </>
  );
}
