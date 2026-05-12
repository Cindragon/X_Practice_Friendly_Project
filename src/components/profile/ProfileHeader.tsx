import { format } from "date-fns";
import { Avatar } from "./Avatar";
import type { ProfileView } from "@/lib/profile";

/**
 * Static visual shell of a profile page: banner + avatar + bio +
 * counts. The action slot (Edit / Follow button) is passed in by the
 * parent server component so this stays a pure presentation piece.
 */
export function ProfileHeader({
  profile,
  action,
}: {
  profile: ProfileView;
  action: React.ReactNode;
}) {
  return (
    <section className="border-b border-zinc-200">
      {/* Banner */}
      <div
        className="relative h-48 w-full bg-zinc-200"
        style={
          profile.bannerUrl
            ? {
                backgroundImage: `url(${profile.bannerUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      />

      {/* Avatar + action row (avatar overlaps the banner) */}
      <div className="flex items-end justify-between px-4">
        <div className="-mt-16">
          <Avatar src={profile.avatarUrl} name={profile.name} size={128} />
        </div>
        <div className="pt-3">{action}</div>
      </div>

      {/* Identity */}
      <div className="px-4 pb-4 pt-3">
        <h2 className="text-xl font-bold leading-tight">
          {profile.name ?? profile.userID}
        </h2>
        <p className="text-sm text-zinc-500">@{profile.userID}</p>

        {profile.bio && (
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-snug text-zinc-800">
            {profile.bio}
          </p>
        )}

        <p className="mt-3 text-sm text-zinc-500">
          Joined {format(new Date(profile.createdAt), "MMMM yyyy")}
        </p>

        <div className="mt-3 flex gap-5 text-sm">
          <span>
            <strong className="text-zinc-900">{profile.followingCount}</strong>{" "}
            <span className="text-zinc-500">Following</span>
          </span>
          <span>
            <strong className="text-zinc-900">{profile.followersCount}</strong>{" "}
            <span className="text-zinc-500">Followers</span>
          </span>
          <span>
            <strong className="text-zinc-900">{profile.postsCount}</strong>{" "}
            <span className="text-zinc-500">Posts</span>
          </span>
        </div>
      </div>
    </section>
  );
}
