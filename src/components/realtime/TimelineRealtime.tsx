"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { getPusherClient } from "@/lib/pusher-client";
import {
  HOME_CHANNEL,
  HOME_EVENT_POST_CREATED,
  type HomePostCreatedPayload,
} from "@/lib/realtime-events";

/**
 * Home timeline realtime hook.
 *
 * Instead of refreshing the moment a new post arrives — which would yank
 * the page out from under someone mid-read — we surface a floating
 * "N new posts" pill at the top of the timeline. Clicking it scrolls to
 * top and refreshes; until then the viewer's place in the feed stays put.
 *
 * Your own new posts skip the pill (the composer already does a refresh
 * on success).
 */
export function TimelineRealtime({ viewerId }: { viewerId: string | null }) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const pusher = getPusherClient();
    if (!pusher) return;

    const channel = pusher.subscribe(HOME_CHANNEL);
    const onCreate = (data: HomePostCreatedPayload) => {
      if (data.authorId === viewerId) return;
      setCount((c) => c + 1);
    };
    channel.bind(HOME_EVENT_POST_CREATED, onCreate);

    return () => {
      channel.unbind(HOME_EVENT_POST_CREATED, onCreate);
      pusher.unsubscribe(HOME_CHANNEL);
    };
  }, [viewerId]);

  if (count === 0) return null;

  return (
    <div className="sticky top-14 z-20 flex justify-center px-4 py-2">
      <button
        type="button"
        onClick={() => {
          setCount(0);
          window.scrollTo({ top: 0, behavior: "smooth" });
          router.refresh();
        }}
        className="flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-md transition hover:bg-sky-600"
      >
        <ArrowUp className="h-4 w-4" aria-hidden />
        {count} new {count === 1 ? "post" : "posts"}
      </button>
    </div>
  );
}
