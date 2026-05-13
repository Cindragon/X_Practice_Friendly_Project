"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  Share,
  Trash2,
} from "lucide-react";
import { clsx } from "clsx";
import { PostComposerModal } from "@/components/composer/PostComposerModal";
import type { FeedItem } from "@/lib/feed";

/**
 * Interactive action bar for a post.
 *
 * Layout: 4-column grid (Reply / Repost / Like / Share) so every icon
 * sits at the same x-coordinate regardless of count width — counts grow
 * inside their own slot rather than pushing the next icon over.
 * The author-only ⋯ menu lives *outside* the grid in a fixed-width
 * trailing slot, so its presence/absence doesn't squash the four
 * action columns.
 *
 * Updates are fully optimistic — every action bumps local state
 * immediately and reverts on failure. We still call router.refresh()
 * after each successful API call so server-rendered counts elsewhere
 * (profile, post detail, sibling cards) catch up; but the card the
 * user clicked never has to wait for the refresh to feel responsive.
 *
 * `viewerIsAuthor` toggles the ⋯ overflow menu;
 * `viewerIsSignedIn` lets us silently no-op interactions for anonymous
 *   viewers (we don't currently expose them publicly).
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
  const [replyCount, setReplyCount] = useState(item.counts.replies);
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
    setRepostCount((c) => c + 1); // optimistic
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
          // No new row was created; undo our optimistic bump.
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
          "mt-2 flex items-center text-zinc-500",
          textCls
        )}
        // Stop the parent Link (PostCard wraps the body in a Link) from
        // capturing clicks on these controls.
        onClick={(e) => e.stopPropagation()}
      >
        {/* Four equally-sized columns. Every post's icons line up at the
           same x because each cell is the same width regardless of its
           count value. */}
        <div className="grid max-w-md flex-1 grid-cols-4 items-center">
          <ActionButton
            onClick={() => setReplyOpen(true)}
            label="Reply"
            hover="hover:text-sky-600"
          >
            <MessageCircle className={iconCls} aria-hidden />
            <Count value={replyCount} />
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

          <ActionButton
            onClick={() => {}}
            label="Share"
            hover="hover:text-sky-600"
          >
            <Share className={iconCls} aria-hidden />
          </ActionButton>
        </div>

        {/* Author-only ⋯ menu lives outside the grid so the 4 action
           columns stay the same width for every post. */}
        <div className="ml-2 w-8 shrink-0">
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
      </div>

      {replyOpen && (
        <PostComposerModal
          onClose={() => setReplyOpen(false)}
          parentId={item.id}
          // Optimistically bump the reply counter the moment the API
          // returns success — don't wait for the refresh to repaint.
          onPostSuccess={() => setReplyCount((c) => c + 1)}
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
        // Inside its grid cell, sit at the LEFT so every icon column
        // shares an x-axis. Count grows to the right inside the same
        // cell rather than pushing the next icon.
        "flex items-center gap-1.5 justify-self-start rounded-full px-2 py-1 transition",
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
