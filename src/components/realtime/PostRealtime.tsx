"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPusherClient } from "@/lib/pusher-client";
import {
  POST_EVENT_DELETED,
  POST_EVENT_LIKE_CHANGED,
  POST_EVENT_REPLY_CREATED,
  POST_EVENT_REPOST_CHANGED,
  postChannel,
  type PostLikeChangedPayload,
} from "@/lib/realtime-events";

/**
 * Mounted by /post/[id] so anyone with the page open keeps seeing
 * fresh state without having to refresh.
 *
 * Strategy: every event triggers `router.refresh()` — server re-renders
 * with the latest data, no client-side state divergence to keep in sync.
 *
 * We do skip our own like echoes (matched by `byUserId === viewerId`)
 * because the optimistic update in <PostActions> already moved the
 * counter; another refresh would briefly flicker the count back to the
 * server's view, then forward again on the next round.
 */
export function PostRealtime({
  postId,
  viewerId,
}: {
  postId: string;
  viewerId: string | null;
}) {
  const router = useRouter();

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return; // not configured — silent no-op

    const channel = pusher.subscribe(postChannel(postId));

    const refresh = () => router.refresh();

    channel.bind(POST_EVENT_REPLY_CREATED, refresh);
    channel.bind(POST_EVENT_REPOST_CHANGED, refresh);
    channel.bind(POST_EVENT_DELETED, refresh);
    channel.bind(POST_EVENT_LIKE_CHANGED, (data: PostLikeChangedPayload) => {
      if (data.byUserId === viewerId) return;
      refresh();
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(postChannel(postId));
    };
  }, [postId, viewerId, router]);

  return null;
}
