import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { loadProfileByUserID } from "@/lib/profile";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { EditProfileModal } from "@/components/profile/EditProfileModal";
import { EmptyTab } from "@/components/profile/EmptyTab";

/**
 * /profile — viewing your own profile.
 *
 * Loads the profile directly from the DB (no internal fetch) so the
 * page is server-rendered with one round-trip. The Edit button is
 * rendered as the header's action slot.
 */
export default async function MyProfilePage() {
  const me = await requireUser();
  const profile = await loadProfileByUserID(me.userID, me.id);

  // Shouldn't happen — requireUser already guarantees the user exists
  // and has a userID — but guard anyway for type safety.
  if (!profile) notFound();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur">
        <h1 className="text-xl font-bold">{profile.name ?? profile.userID}</h1>
        <p className="text-sm text-zinc-500">{profile.postsCount} posts</p>
      </header>

      <ProfileHeader
        profile={profile}
        action={
          <EditProfileModal
            initial={{
              name: profile.name,
              bio: profile.bio,
              avatarUrl: profile.avatarUrl,
              bannerUrl: profile.bannerUrl,
            }}
          />
        }
      />

      <ProfileTabs
        postsSlot={<EmptyTab message="You haven't posted yet." />}
        likesSlot={<EmptyTab message="Posts you like will show here." />}
      />
    </>
  );
}
