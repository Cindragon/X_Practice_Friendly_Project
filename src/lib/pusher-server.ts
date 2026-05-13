import Pusher from "pusher";

/**
 * Server-side Pusher client (HMR-safe via globalThis cache).
 *
 * Returns null when the keys aren't configured so the rest of the app
 * keeps working — `triggerSafe()` swallows the gap so callers don't
 * have to null-check at every fire site.
 */
type GlobalWithPusher = typeof globalThis & {
  __pusherServer?: Pusher | null;
};

function buildPusher(): Pusher | null {
  const { PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER } =
    process.env;
  if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
    return null;
  }
  return new Pusher({
    appId: PUSHER_APP_ID,
    key: PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: PUSHER_CLUSTER,
    useTLS: true,
  });
}

export function getPusherServer(): Pusher | null {
  const g = globalThis as GlobalWithPusher;
  if (g.__pusherServer === undefined) {
    g.__pusherServer = buildPusher();
  }
  return g.__pusherServer;
}

/**
 * Fire-and-forget broadcast. Silently no-ops when Pusher isn't
 * configured, and logs (but doesn't throw) on transport errors —
 * dropping a realtime nudge is never worth failing the request.
 */
export async function triggerSafe(
  channel: string,
  event: string,
  payload: unknown
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;
  try {
    await pusher.trigger(channel, event, payload);
  } catch (err) {
    console.warn(`[pusher] trigger ${channel}/${event} failed:`, err);
  }
}
