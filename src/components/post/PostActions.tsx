"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart, MessageCircle, MoreHorizontal, Repeat2, Share, Trash2 } from "lucide-react";
import { clsx } from "clsx";
import { PostComposerModal } from "@/components/composer/PostComposerModal";
import type { FeedItem } from "@/lib/feed";

/**
 * Interactive action bar for a post. Drop-in replacement for the static
 * counts row we shipped in Step 8.
 *
 * Buttons are optimistic — the UI flips first, then the API call goes
 * out, then we revert on failure. After success we `router.refresh()`
 * so server-rendered counts elsewhere (profile, timeline) catch up.
 *
 * `viewerIsAuthor` toggles a "delete" entry in the overflow menu;
 * `viewerIsSignedIn` lets us silently no-op like/repost for anonymous
 * viewers (we don't currently expose them but the spec leaves room).
 */
export function PostActions({
  item,
  viewerIsAuthor,
  viewerIsSignedIn,
  size = "sm",
}: {
  item: FeedItem;
  viewerIsAuthor: boolean;
  viewerIsSignedIn: boolean;
  /** "sm" for timeline cards, "md" for the focused post on /post/[id]. */
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = useState(false);

  const [liked, setLiked] = useState(item.likedByMe);
  const [likeCount, setLikeCount] = useState(item.counts.likes);
  const [repostCount, setRepostCount] = useState(item.counts.reposts);
  const [, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleLike() {
    if (!viewerIsSignedIn) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    startTransition(async () => {
      try {
        const res = await fetch(`/api/posts/${item.id}/like`, {
          method: next ? "POST" : "DELETE",
        });
        if (!res.ok) {
          setLiked(!next);
          setLikeCount((c) => c + (next ? -1 : 1));
          return;
        }
        router.refresh();
      } catch {
        setLiked(!next);
        setLikeCount((c) => c + (next ? -1 : 1));
      }
    });
  }

  function repost() {
    if (!viewerIsSignedIn) return;
    // Optimistically bump; if the API tells us we'd already reposted,
    // it's still a +1 from the previous state's perspective only when
    // the server actually created a row. We revert in either failure
    // case below.
    setRepostCount((c) => c + 1);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/posts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repostOfId: item.id }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          data?: { alreadyReposted?: boolean };
        };
        if (!res.ok) {
          setRepostCount((c) => c - 1);
          return;
        }
        if (json.data?.alreadyReposted) {
          // Server didn't create a row; undo our optimistic bump.
          setRepostCount((c) => c - 1);
        }
        router.refresh();
      } catch {
        setRepostCount((c) => c - 1);
      }
    });
  }

  async function onDelete() {
    if (!viewerIsAuthor) return;
    if (!confirm("Delete this post?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${item.id}`, { method: "DELETE" });
      if (!res.ok) {
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }

  const iconCls = size === "md" ? "h-5 w-5" : "h-4 w-4";
  const textCls = size === "md" ? "text-base" : "text-sm";

  return (
    <>
      <div
        className={clsx(
          "mt-2 flex max-w-md items-center justify-between text-zinc-500",
          textCls
        )}
        // Stop the parent Link (PostCard wraps the body in a Link) from
        // capturing clicks on these controls.
        onClick={(e) => e.stopPropagation()}
      >
        <ActionButton
          onClick={() => setReplyOpen(true)}
          label="Reply"
          hover="hover:text-sky-600"
        >
          <MessageCircle className={iconCls} aria-hidden />
          <Count value={item.counts.replies} />
        </ActionButton>

        <ActionButton
          onClick={repost}
          label="Repost"
          hover="hover:text-emerald-600"
          disabled={!viewerIsSignedIn}
        >
          <Repeat2 className={iconCls} aria-hidden />
          <Count value={repostCount} />
        </ActionButton>

        <ActionButton
          onClick={toggleLike}
          label={liked ? "Unlike" : "Like"}
          hover="hover:text-red-600"
          active={liked}
          activeColor="text-red-600"
          disabled={!viewerIsSignedIn}
        >
          <Heart
            className={iconCls}
            aria-hidden
            fill={liked ? "currentColor" : "none"}
          />
          <Count value={likeCount} />
        </ActionButton>

        <ActionButton onClick={() => {}} label="Share" hover="hover:text-sky-600">
          <Share className={iconCls} aria-hidden />
        </ActionButton>

        {viewerIsAuthor && (
          <div className="relative">
            <ActionButton
              onClick={() => setMenuOpen((o) => !o)}
              label="More"
              hover="hover:text-zinc-900"
              disabled={deleting}
            >
              <MoreHorizontal className={iconCls} aria-hidden />
            </ActionButton>
            {menuOpen && (
              <div
                className="absolute right-0 z-20 mt-1 w-40 rounded-xl border border-zinc-200 bg-white py-1 shadow-md"
                role="menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {replyOpen && (
        <PostComposerModal
          onClose={() => setReplyOpen(false)}
          parentId={item.id}
        />
      )}
    </>
  );
}

function ActionButton({
  onClick,
  label,
  hover,
  active,
  activeColor,
  disabled,
  children,
}: {
  onClick: () => void;
  label: string;
  hover: string;
  active?: boolean;
  activeColor?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      disabled={disabled}
      className={clsx(
        "flex items-center gap-1.5 rounded-full px-2 py-1 transition",
        active ? activeColor : "",
        hover,
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      {children}
    </button>
  );
}

function Count({ value }: { value: number }) {
  if (!value) return null;
  return <span className="tabular-nums">{value}</span>;
}
