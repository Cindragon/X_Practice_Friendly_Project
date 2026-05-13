/**
 * Shared channel + event constants for Pusher.
 *
 * Importing this file is free on either side of the wire: it has zero
 * runtime deps and no Node-only imports. Server route handlers use it
 * to publish, client components use it to subscribe.
 *
 * Channels
 *   timeline-home          : global, all top-level posts
 *   post-<objectId>        : per-post events (replies / reposts / likes /
 *                            delete) for anyone viewing /post/<id>
 *
 * Events on `timeline-home`
 *   post-created           : a new top-level post landed
 *
 * Events on `post-<id>`
 *   reply-created          : someone replied to this post
 *   repost-changed         : someone reposted (or, after delete, removed)
 *                            this post
 *   like-changed           : like count moved (with the latest count)
 *   post-deleted           : this post was soft-deleted
 *
 * Payloads stay small — viewers fetch fresh data via router.refresh()
 * rather than reading message bodies, so we just include the bits the
 * subscriber needs to decide whether to refresh and how to render the
 * "N new posts" pill before the user clicks it.
 */

export const HOME_CHANNEL = "timeline-home";
export function postChannel(postId: string): string {
  return `post-${postId}`;
}

export const HOME_EVENT_POST_CREATED = "post-created";

export const POST_EVENT_REPLY_CREATED = "reply-created";
export const POST_EVENT_REPOST_CHANGED = "repost-changed";
export const POST_EVENT_LIKE_CHANGED = "like-changed";
export const POST_EVENT_DELETED = "post-deleted";

// ── Payload types ──────────────────────────────────────────────────────────

export type HomePostCreatedPayload = {
  postId: string;
  authorId: string;
};

export type PostReplyCreatedPayload = {
  parentId: string;
  replyId: string;
  authorId: string;
};

export type PostRepostChangedPayload = {
  postId: string;
  /** Per-event delta to the reposts count (+1 on create, -1 on undo). */
  delta: number;
};

export type PostLikeChangedPayload = {
  postId: string;
  /** Per-event delta to the likes count. */
  delta: number;
  /** The user who triggered the change — so a sender can ignore their own echo. */
  byUserId: string;
};

export type PostDeletedPayload = {
  postId: string;
};
