import { loadLikedByUser } from "@/lib/feed";
import { PostCard } from "@/components/post/PostCard";
import { EmptyTab } from "./EmptyTab";

/**
 * Server component for the Likes tab on a profile page.
 *
 * Renders a single page of posts the profile owner has liked, newest
 * like first. Tab switching is purely client-side (ProfileTabs holds
 * the active tab state), so each tab can be its own async server
 * component without coordination.
 *
 * Note: when the viewer is looking at someone else's likes, the
 * "liked by me" / "delete" affordances on each card reflect the
 * VIEWER, not the profile owner — exactly the right behaviour.
 */
export async function LikesTab({
  ownerId,
  viewerId,
  emptyMessage,
}: {
  ownerId: string;
  viewerId: string | null;
  emptyMessage: string;
}) {
  const page = await loadLikedByUser(ownerId, viewerId, { limit: 20 });

  if (page.items.length === 0) {
    return <EmptyTab message={emptyMessage} />;
  }

  return (
    <ol>
      {page.items.map((item) => (
        <li key={item.id}>
          <PostCard item={item} viewerId={viewerId} />
        </li>
      ))}
    </ol>
  );
}
