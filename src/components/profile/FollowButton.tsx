"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

/**
 * Follow / Unfollow toggle. Optimistically flips the visible state,
 * fires POST or DELETE /api/users/[userID]/follow, then refreshes the
 * server tree so the follower/following counts update.
 *
 * The "Following" pill switches to "Unfollow" on hover so the user can
 * tell what clicking will do — same convention X uses.
 */
export function FollowButton({
  targetUserID,
  initialFollowing,
}: {
  targetUserID: string;
  initialFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [hover, setHover] = useState(false);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next); // optimistic

    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${targetUserID}/follow`, {
          method: next ? "POST" : "DELETE",
        });
        if (!res.ok) {
          setFollowing(!next); // revert
          return;
        }
        router.refresh();
      } catch {
        setFollowing(!next);
      }
    });
  }

  const label = following ? (hover ? "Unfollow" : "Following") : "Follow";

  return (
    <button
      type="button"
      onClick={toggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={pending}
      className={clsx(
        "min-w-[110px] rounded-full px-4 py-1.5 text-sm font-semibold transition disabled:opacity-60",
        following
          ? hover
            ? "border border-red-300 bg-white text-red-600"
            : "border border-zinc-300 bg-white text-zinc-900"
          : "bg-zinc-900 text-white hover:bg-zinc-800"
      )}
    >
      {label}
    </button>
  );
}
