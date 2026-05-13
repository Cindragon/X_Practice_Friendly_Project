"use client";

import PusherClient from "pusher-js";

/**
 * Browser-side Pusher client. Lazily instantiated on first subscription
 * so SSR + pages that don't use realtime pay nothing for the import.
 *
 * Disabled (returns null) when the NEXT_PUBLIC_PUSHER_* env vars aren't
 * set so dev still works without Pusher credentials — subscribers
 * become no-ops.
 */
let cached: PusherClient | null | undefined;

export function getPusherClient(): PusherClient | null {
  if (cached !== undefined) return cached;

  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;
  if (!key || !cluster) {
    cached = null;
    return cached;
  }

  cached = new PusherClient(key, { cluster });
  return cached;
}
